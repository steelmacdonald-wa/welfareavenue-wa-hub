// Welfare Avenue: finance-drive (v5, 09/11/26, wave302)
// v5: action 'balances' reads the opening and closing balance printed on each imported statement that has none yet
// (finance_statements.opening_balance / closing_balance; finance-import v7 stores them for new statements), and 'run'
// does up to three of them. The Finance page's In the bank comes from these.
// v4: a vendor written with capitals keeps them in proposed names (only an all-lower-case one is title-cased).
// v3: currencies (WA's software bills in US dollars; BMO shows the Canadian amount), e-Transfer notices name the person
// not BMO, a file named "...contract..." is a contract, an invoice in a Donations folder is an in-kind gift (no bank
// line), and one charge's documents are grouped (finance_group_docs) before moves are proposed.
// v2: a BMO statement is known by its name ("October 30, 2026.pdf") wherever it sits; statements outside a
// Bank Statements folder get a move proposed; approved moves create the folder they need.
// v1: Steel (08/11/26): every two weeks the Hub checks the Accounting shared drive's Year End folders for new bank
// statements, bills and donation receipts; brings new statements into Finance (through finance-import); reads
// bills, reimbursements and invoice emails for vendor, date and total; matches them to bank lines
// (finance_match_docs); and proposes moves and renames, which wait for a person's yes (finance_doc_act) and are
// carried out by action 'apply'. Drive is read and written as hub@welfareavenue.com (domain-wide delegation of
// the wa-hub-drive service account), falling back to the service account itself.
// Actions: run (the cron: everything within the time budget) | scan | read | emails | suggest | match | apply | balances | status
// Auth: x-wa-secret (cron) or a staff sign-in that can open Finance.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';

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
const DRIVE = 'https://www.googleapis.com/drive/v3';
const FOLDER = 'application/vnd.google-apps.folder';
const STMT_NAME = /^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},\s+\d{4}(\s*\(\d+\))?\.pdf$/i;

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}

type Caller = { who: string; system: boolean };
async function authorize(req: Request): Promise<Caller | null> {
  const given = req.headers.get('x-wa-secret');
  if (given) { try { if (given === (await getSecret('WA_TRIGGER_SECRET'))) return { who: 'automation', system: true }; } catch (_) { /* no */ } }
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ') || auth === 'Bearer ' + ANON_KEY) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  if (!email) return null;
  const [{ data: staff }, { data: page }] = await Promise.all([asUser.rpc('is_wa_staff'), asUser.rpc('wa_page_ok', { p_tab: 'finances' })]);
  if (staff !== true || page === false) return null;
  return { who: email, system: false };
}

type Cfg = { drive_id: string; impersonate: string; fy_end_month: number };
async function config(): Promise<Cfg> {
  const { data } = await svc.from('app_config').select('value').eq('key', 'finance_drive').maybeSingle();
  const v = JSON.parse(String((data as { value?: string } | null)?.value || '{}'));
  return { drive_id: v.drive_id || '0AMY5WrzZJPFiUk9PVA', impersonate: v.impersonate || 'hub@welfareavenue.com', fy_end_month: Number(v.fy_end_month || 9) };
}

/* ---------- Google auth ---------- */
function b64url(bytes: Uint8Array): string { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function pemToDer(pem: string): Uint8Array { const raw = atob(pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '')); const o = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) o[i] = raw.charCodeAt(i); return o; }
const TOKENS: Record<string, { v: string; exp: number }> = {};
async function mint(sub: string | null, scope: string): Promise<string | null> {
  const k = (sub || '-') + scope;
  if (TOKENS[k] && Date.now() < TOKENS[k].exp - 60000) return TOKENS[k].v;
  const sa = JSON.parse(await getSecret('GOOGLE_SA_KEY'));
  const now = Math.floor(Date.now() / 1000); const enc = new TextEncoder();
  const claims: Record<string, unknown> = { iss: sa.client_email, scope, aud: sa.token_uri, iat: now, exp: now + 3600 };
  if (sub) claims.sub = sub;
  const input = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))) + '.' + b64url(enc.encode(JSON.stringify(claims)));
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(input)));
  const res = await fetch(sa.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: input + '.' + b64url(sig) }) });
  const body = await res.json();
  if (!body.access_token) return null;
  TOKENS[k] = { v: body.access_token, exp: Date.now() + (body.expires_in || 3600) * 1000 };
  return body.access_token;
}
async function gtoken(cfg: Cfg, write: boolean): Promise<string> {
  const scope = 'https://www.googleapis.com/auth/drive' + (write ? '' : '.readonly');
  const t = (await mint(cfg.impersonate, scope)) || (await mint(null, scope));
  if (!t) throw new Error('Google sign-in failed for ' + cfg.impersonate);
  return t;
}

/* ---------- Drive ---------- */
type DFile = { id: string; name: string; mimeType: string; modifiedTime?: string; size?: string; webViewLink?: string };
async function children(tok: string, id: string): Promise<DFile[]> {
  const out: DFile[] = []; let page = '';
  for (let i = 0; i < 20; i++) {
    const p = new URLSearchParams({ q: "'" + id + "' in parents and trashed = false", fields: 'nextPageToken, files(id,name,mimeType,modifiedTime,size,webViewLink)', pageSize: '200', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', corpora: 'allDrives' });
    if (page) p.set('pageToken', page);
    const r = await fetch(DRIVE + '/files?' + p, { headers: { Authorization: 'Bearer ' + tok } });
    const b = await r.json();
    if (b.error) throw new Error('Drive: ' + String(b.error.message || '').slice(0, 200));
    out.push(...(b.files || [])); page = b.nextPageToken || ''; if (!page) break;
  }
  return out;
}
async function download(tok: string, id: string): Promise<Uint8Array> {
  const r = await fetch(DRIVE + '/files/' + id + '?alt=media&supportsAllDrives=true', { headers: { Authorization: 'Bearer ' + tok } });
  if (!r.ok) throw new Error('Drive download ' + r.status);
  return new Uint8Array(await r.arrayBuffer());
}
async function ensurePath(tok: string, cfg: Cfg, path: string): Promise<string> {
  let parent = cfg.drive_id;
  for (const seg of path.split(' / ').map(s => s.trim()).filter(Boolean)) {
    const kids = await children(tok, parent);
    const hit = kids.find(k => k.mimeType === FOLDER && k.name.trim().toLowerCase() === seg.toLowerCase());
    if (hit) { parent = hit.id; continue; }
    const r = await fetch(DRIVE + '/files?supportsAllDrives=true&fields=id', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: seg, mimeType: FOLDER, parents: [parent] }) });
    const b = await r.json(); if (!b.id) throw new Error('could not create folder ' + seg + ': ' + String(b.error?.message || r.status).slice(0, 150));
    parent = b.id;
  }
  return parent;
}

/* ---------- fiscal years and folder kinds ---------- */
function fyOfDate(d: Date, endMonth: number): number { const y = d.getUTCFullYear(); return (d.getUTCMonth() + 1) > endMonth ? y + 1 : y; }
const fyLabel = (y: number) => 'FY' + String(y).slice(2);
function fyOfFolder(name: string): number | null { const m = /year\s*end\s*(\d{4})/i.exec(name); return m ? Number(m[1]) : null; }
function kindOfPath(path: string): string {
  const p = path.toLowerCase();
  if (/reimburs/.test(p)) return 'reimbursement';
  if (/bank|statement/.test(p)) return 'statement';
  if (/bill/.test(p)) return 'bill';
  if (/donation|receipt/.test(p)) return 'donation';
  if (/budget/.test(p)) return 'budget';
  if (/contract/.test(p)) return 'contract';
  return 'other';
}
function stmtDate(name: string): string | null {
  const m = /^([a-z]+)\s+(\d{1,2}),\s+(\d{4})/i.exec(name.trim()); if (!m) return null;
  const d = new Date(m[1] + ' ' + m[2] + ', ' + m[3] + ' 12:00 UTC'); return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

type Tree = { root: DFile[]; years: Record<number, { folder: DFile; kinds: Record<string, DFile> }> };
async function loadTree(tok: string, cfg: Cfg): Promise<Tree> {
  const root = await children(tok, cfg.drive_id);
  const years: Tree['years'] = {};
  for (const f of root) {
    const y = f.mimeType === FOLDER ? fyOfFolder(f.name) : null;
    if (!y) continue;
    const kinds: Record<string, DFile> = {};
    for (const c of await children(tok, f.id)) if (c.mimeType === FOLDER) { const k = kindOfPath(c.name); if (!kinds[k]) kinds[k] = c; }
    years[y] = { folder: f, kinds };
  }
  return { root, years };
}
/* where a document of this kind and year belongs: the existing folder, or the path to create */
function targetFor(tree: Tree, fy: number, kind: string): { id: string | null; name: string } | null {
  const y = tree.years[fy]; if (!y) return null;
  const k = kind === 'reimbursement' ? 'bill' : kind;
  const hit = y.kinds[kind] || y.kinds[k];
  if (hit) return { id: hit.id, name: y.folder.name + ' / ' + hit.name };
  const sub = k === 'statement' ? 'Bank Statements' : k === 'bill' ? 'BILLS ' + fy : k === 'donation' ? 'Donations' : null;
  return sub ? { id: null, name: y.folder.name + ' / ' + sub } : null;
}

/* ---------- scan: record every file in the chosen Year End folders ---------- */
async function scan(tok: string, cfg: Cfg, tree: Tree, all: boolean) {
  const nowFy = fyOfDate(new Date(), cfg.fy_end_month);
  const ys = Object.keys(tree.years).map(Number).filter(y => all || y === nowFy || y === nowFy - 1);
  type Found = { f: DFile; path: string; folder: string; fy: number; kind: string };
  const found: Found[] = [];
  async function walk(id: string, path: string, fy: number, depth: number) {
    for (const c of await children(tok, id)) {
      const p = path + ' / ' + c.name;
      if (c.mimeType === FOLDER) { if (depth < 3) await walk(c.id, p, fy, depth + 1); continue; }
      let kind = kindOfPath(path.split(' / ').slice(1).join(' / '));
      if (kind === 'other' && c.mimeType === 'application/pdf' && STMT_NAME.test(c.name.trim())) kind = 'statement';
      if (/contract/i.test(c.name)) kind = 'contract';
      found.push({ f: c, path, folder: id, fy, kind });
    }
  }
  for (const y of ys) await walk(tree.years[y].folder.id, tree.years[y].folder.name, y, 0);
  const ids = found.map(x => x.f.id);
  const known = new Map<string, { id: number; drive_modified: string | null; kind: string; read_state: string }>();
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await svc.from('finance_docs').select('id, drive_file_id, drive_modified, kind, read_state').in('drive_file_id', ids.slice(i, i + 150));
    for (const r of (data || []) as { id: number; drive_file_id: string; drive_modified: string | null; kind: string; read_state: string }[]) known.set(r.drive_file_id, r);
  }
  const added: Record<string, number> = {};
  const fresh: Record<string, unknown>[] = [];
  const noMatch = (kind: string) => kind === 'statement' || kind === 'budget' || kind === 'contract';
  for (const x of found) {
    const base = { name: x.f.name, mime: x.f.mimeType, folder_id: x.folder, folder_path: x.path, fiscal_year: fyLabel(x.fy), url: x.f.webViewLink || null, drive_modified: x.f.modifiedTime || null, size_bytes: x.f.size ? Number(x.f.size) : null, updated_at: new Date().toISOString() };
    const k = known.get(x.f.id);
    if (!k) {
      fresh.push({ ...base, source: 'drive', kind: x.kind, drive_file_id: x.f.id,
        read_state: x.kind === 'budget' ? 'skipped' : x.kind === 'contract' ? 'read' : 'new',
        match_state: noMatch(x.kind) ? 'not_needed' : 'open',
        match_note: x.kind === 'contract' ? 'A contract: no bank line to match.' : null,
        doc_date: x.kind === 'statement' ? stmtDate(x.f.name) : null });
      added[x.kind] = (added[x.kind] || 0) + 1;
    } else {
      const changed = k.drive_modified && x.f.modifiedTime && new Date(k.drive_modified).getTime() !== new Date(x.f.modifiedTime).getTime();
      const reKind = k.kind !== x.kind && (k.kind === 'other' || x.kind === 'contract');
      await svc.from('finance_docs').update({ ...base,
        ...(changed && !noMatch(k.kind) ? { read_state: 'new' } : {}),
        ...(reKind ? { kind: x.kind, ...(noMatch(x.kind) ? { match_state: 'not_needed', read_state: x.kind === 'contract' ? 'read' : k.read_state } : {}) } : {}) }).eq('id', k.id);
    }
  }
  for (let i = 0; i < fresh.length; i += 100) { const { error } = await svc.from('finance_docs').insert(fresh.slice(i, i + 100)); if (error) throw new Error('save: ' + error.message); }
  return { folders: ys.map(y => tree.years[y].folder.name), files: found.length, added };
}

/* ---------- statements: bring new ones into Finance ---------- */
async function statements(tok: string, maxImports: number, started: number) {
  const { data: docs } = await svc.from('finance_docs').select('id, name, mime, drive_file_id, read_state').eq('kind', 'statement').is('statement_id', null).in('read_state', ['new', 'failed']).order('name');
  const out = { linked: 0, imported: [] as string[], failed: [] as string[], waiting: 0 };
  let done = 0;
  for (const d of (docs || []) as { id: number; name: string; mime: string; drive_file_id: string; read_state: string }[]) {
    const { data: prior } = await svc.from('finance_statements').select('id, period_end').eq('filename', d.name).eq('status', 'done').order('id', { ascending: false }).limit(1);
    if (prior && prior.length) {
      await svc.from('finance_docs').update({ statement_id: prior[0].id, read_state: 'read', doc_date: prior[0].period_end, updated_at: new Date().toISOString() }).eq('id', d.id);
      out.linked++; continue;
    }
    if (d.mime !== 'application/pdf') { await svc.from('finance_docs').update({ read_state: 'skipped', read_error: 'Not a PDF statement' }).eq('id', d.id); continue; }
    if (done >= maxImports || Date.now() - started > 25000) { out.waiting++; continue; }
    done++;
    try {
      const bytes = await download(tok, d.drive_file_id);
      const res = await fetch(SUPABASE_URL + '/functions/v1/finance-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + SERVICE_KEY, 'x-wa-secret': await getSecret('WA_TRIGGER_SECRET') },
        body: JSON.stringify({ pdf_base64: encodeBase64(bytes), filename: d.name })
      });
      const r = await res.json().catch(() => ({}));
      if (!res.ok || !r.statement_id || r.error) throw new Error(String(r.error || res.status));
      await svc.from('finance_docs').update({ statement_id: r.statement_id, read_state: 'read', read_error: null, doc_date: r.period_end || null,
        summary: (r.imported || 0) + ' bank lines, ' + (r.period_start || '?') + ' to ' + (r.period_end || '?') + (r.duplicates ? ' (' + r.duplicates + ' already in)' : ''), updated_at: new Date().toISOString() }).eq('id', d.id);
      await svc.from('finance_statements').delete().eq('filename', d.name).eq('status', 'failed').eq('txn_count', 0);
      out.imported.push(d.name);
    } catch (e) {
      await svc.from('finance_docs').update({ read_state: 'failed', read_error: String((e as Error).message || e).slice(0, 300) }).eq('id', d.id);
      out.failed.push(d.name);
    }
  }
  return out;
}

/* ---------- statement balances (v5): read the printed opening and closing balance ---------- */
const BAL_TOOL = {
  name: 'read_statement_balances', description: 'Report the balances printed on the bank statement.',
  input_schema: { type: 'object', properties: {
    period_end: { type: ['string', 'null'], description: 'ISO date the statement period ends' },
    opening_balance: { type: ['number', 'null'] }, closing_balance: { type: ['number', 'null'] }
  }, required: ['opening_balance', 'closing_balance'] }
};
async function balances(tok: string, started: number, budget: number, max: number) {
  const { data: rows } = await svc.from('finance_statements').select('id, filename, period_end').eq('status', 'done').is('closing_balance', null).order('period_end', { ascending: false, nullsFirst: false }).limit(40);
  const out = { read: 0, failed: [] as string[], waiting: 0, no_file: 0 };
  let n = 0;
  for (const r of (rows || []) as { id: number; filename: string; period_end: string | null }[]) {
    if (n >= max || Date.now() - started > budget) { out.waiting++; continue; }
    const { data: docs } = await svc.from('finance_docs').select('drive_file_id').eq('kind', 'statement').or('statement_id.eq.' + r.id + ',name.eq.' + JSON.stringify(r.filename)).not('drive_file_id', 'is', null).limit(1);
    const fileId = docs && docs.length ? (docs[0] as { drive_file_id: string }).drive_file_id : null;
    if (!fileId) { out.no_file++; continue; }
    n++;
    try {
      const b64 = encodeBase64(await download(tok, fileId));
      const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + SERVICE_KEY, 'x-wa-task': 'finance_doc_read', 'x-wa-caller': 'finance-drive', 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_tokens: 300, temperature: 0,
          system: 'You read one BMO business bank statement. Report the opening balance and the closing balance printed on it (the summary of account, or the first and last running balance), as plain numbers. A negative (overdrawn) balance is negative. Nothing invented: null when it is not shown.',
          messages: [{ role: 'user', content: [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }, { type: 'text', text: 'What are the opening and closing balances?' }] }],
          tools: [BAL_TOOL], tool_choice: { type: 'tool', name: 'read_statement_balances' } })
      });
      const body = await res.json().catch(() => ({}));
      const tu = (body.content || []).find((c: { type: string }) => c.type === 'tool_use');
      if (!res.ok || !tu?.input) throw new Error('reader: ' + String(body?.error?.message || res.status).slice(0, 200));
      const num = (v: unknown) => typeof v === 'number' && isFinite(v) && Math.abs(v) < 1e9 ? Math.round(v * 100) / 100 : null;
      const ob = num(tu.input.opening_balance), cb = num(tu.input.closing_balance);
      if (cb === null) throw new Error('no closing balance on the statement');
      await svc.from('finance_statements').update({ opening_balance: ob, closing_balance: cb }).eq('id', r.id);
      out.read++;
    } catch (e) { out.failed.push(r.filename + ': ' + String((e as Error).message || e).slice(0, 120)); }
  }
  return out;
}

/* ---------- reading bills, receipts and invoice emails ---------- */
const READ_SYSTEM = `You read one money document for Welfare Avenue, a volunteer-run Montreal and Toronto charity that serves meals to people experiencing homelessness. The document is a bill, invoice, receipt, reimbursement claim, donation receipt, contract, or an email about a payment. Report what it says, nothing invented.
- vendor: the business or person on the other side, short and plain ("U-Haul", "DigitalOcean", "Pizza Pizza", "Gift Funds Canada"). Never Welfare Avenue itself. For an Interac e-Transfer notice the vendor is the person who sent or received the money, never BMO, the bank or Interac.
- date: the invoice, receipt or payment date as YYYY-MM-DD.
- total: the final total charged or received, tax included, as a positive number. Null if there is no amount.
- currency: the currency of the total. "USD" when the document says USD or US$, or when a United States company bills in plain $ with no CAD shown (DigitalOcean, Netlify, Quo or OpenPhone, Atlassian or Loom, Meta, Google, Anthropic, OpenAI bill Welfare Avenue in USD). Otherwise "CAD".
- direction: "out" when Welfare Avenue pays (bills, invoices, receipts for purchases, reimbursements, sent e-Transfers, declined payments); "in" when Welfare Avenue receives money (grants, donations of money, received e-Transfers, refunds); "none" when no money moves through the bank (contracts, quotes, in-kind donations of goods, donation receipts Welfare Avenue issued for goods).
- doc_type: payment_declined only when a card or account payment to a business failed; transfer_notice for any Interac e-Transfer notice, including one the recipient has not claimed yet or a reminder to reclaim the funds; incoming_funds for grants or money on its way to Welfare Avenue; donation_receipt for official donation receipts; contract for agreements; otherwise invoice, receipt or bill.
- purpose: two to four words on what it was for, when the document says ("holiday event", "storage unit", "team gifts"). Null if unclear.
- paid_by: for a reimbursement, the first name of the person who paid, if shown or in the file name.
- summary: one plain sentence. No em dashes anywhere.`;
const READ_TOOL = {
  name: 'read_money_doc', description: 'Report what the money document says.',
  input_schema: { type: 'object', properties: {
    doc_type: { type: 'string', enum: ['invoice', 'receipt', 'bill', 'payment_declined', 'transfer_notice', 'incoming_funds', 'donation_receipt', 'contract', 'other'] },
    vendor: { type: 'string' }, date: { type: ['string', 'null'] }, total: { type: ['number', 'null'] }, currency: { type: 'string', enum: ['CAD', 'USD', 'EUR', 'other'] },
    direction: { type: 'string', enum: ['out', 'in', 'none'] }, reference: { type: ['string', 'null'] },
    purpose: { type: ['string', 'null'] }, paid_by: { type: ['string', 'null'] }, summary: { type: 'string' }
  }, required: ['doc_type', 'vendor', 'direction', 'currency', 'summary'] }
};
type Read = { doc_type: string; vendor: string; date?: string | null; total?: number | null; currency?: string | null; direction: string; reference?: string | null; purpose?: string | null; paid_by?: string | null; summary: string };
async function readWithModel(content: unknown[]): Promise<Read> {
  const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + SERVICE_KEY, 'x-wa-task': 'finance_doc_read', 'x-wa-caller': 'finance-drive', 'Content-Type': 'application/json' },
    body: JSON.stringify({ max_tokens: 800, temperature: 0, system: READ_SYSTEM, messages: [{ role: 'user', content }], tools: [READ_TOOL], tool_choice: { type: 'tool', name: 'read_money_doc' } })
  });
  const body = await res.json().catch(() => ({}));
  const tu = (body.content || []).find((c: { type: string }) => c.type === 'tool_use');
  if (!res.ok || !tu?.input) throw new Error('reader: ' + String(body?.error?.message || res.status).slice(0, 200));
  return tu.input as Read;
}
const isoOk = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
function curOf(c: unknown): string { const s = String(c || '').toUpperCase(); return /US/.test(s) ? 'USD' : /EUR/.test(s) ? 'EUR' : s === 'OTHER' ? 'OTHER' : 'CAD'; }
function fields(r: Read, inKindFolder = false) {
  const date = isoOk(r.date);
  const amount = typeof r.total === 'number' && isFinite(r.total) && r.total > 0 ? Math.round(r.total * 100) / 100 : null;
  // an invoice kept in a Donations folder is the value of goods given to WA: no money moved
  const none = r.direction === 'none' || (inKindFolder && r.direction === 'out');
  const direction = none ? null : (r.direction === 'in' || r.direction === 'out' ? r.direction : null);
  return {
    vendor: (r.vendor || '').slice(0, 80) || null, doc_date: date, amount, direction, currency: curOf(r.currency), doc_type: r.doc_type,
    doc_ref: r.reference ? String(r.reference).slice(0, 80) : null, summary: (r.summary || '').slice(0, 300), read_state: 'read', read_error: null,
    ...(none ? { match_state: 'not_needed', match_note: inKindFolder ? 'An in-kind gift: goods, not money, so no bank line.' : 'No money moves through the bank for this one.' } : {}),
    updated_at: new Date().toISOString()
  };
}
const IMG = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
async function readDrive(tok: string, started: number, budget: number) {
  const { data: docs } = await svc.from('finance_docs').select('id, name, mime, drive_file_id, size_bytes, kind').eq('source', 'drive').in('kind', ['bill', 'reimbursement', 'donation', 'other']).eq('read_state', 'new').order('id').limit(40);
  const out = { read: 0, skipped: 0, failed: 0, waiting: 0 };
  for (const d of (docs || []) as { id: number; name: string; mime: string; drive_file_id: string; size_bytes: number | null; kind: string }[]) {
    if (Date.now() - started > budget) { out.waiting++; continue; }
    const pdf = d.mime === 'application/pdf';
    if (!pdf && !IMG.includes(d.mime)) { await svc.from('finance_docs').update({ read_state: 'skipped', read_error: 'Not a PDF or photo', match_state: 'not_needed' }).eq('id', d.id); out.skipped++; continue; }
    if ((d.size_bytes || 0) > 5_000_000) { await svc.from('finance_docs').update({ read_state: 'skipped', read_error: 'Over 5 MB: too large to read', match_note: 'Too large for the Hub to read. Match it by hand.' }).eq('id', d.id); out.skipped++; continue; }
    try {
      const b64 = encodeBase64(await download(tok, d.drive_file_id));
      const block = pdf ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } } : { type: 'image', source: { type: 'base64', media_type: d.mime, data: b64 } };
      const r = await readWithModel([block, { type: 'text', text: 'File name: ' + d.name + '. Folder kind: ' + d.kind + '.' }]);
      await svc.from('finance_docs').update({ ...fields(r, d.kind === 'donation'), kind: r.doc_type === 'contract' ? 'contract' : d.kind, suggestion_note: JSON.stringify({ purpose: r.purpose || null, paid_by: r.paid_by || null }) }).eq('id', d.id);
      out.read++;
    } catch (e) {
      await svc.from('finance_docs').update({ read_state: 'failed', read_error: String((e as Error).message || e).slice(0, 300) }).eq('id', d.id); out.failed++;
    }
  }
  return out;
}
async function readEmails(cfg: Cfg, started: number, budget: number) {
  const { data: have } = await svc.from('finance_docs').select('hub_mail_id').not('hub_mail_id', 'is', null);
  const seen = new Set(((have || []) as { hub_mail_id: number }[]).map(r => r.hub_mail_id));
  const { data: mails } = await svc.from('hub_mail').select('id, internal_date, from_name, from_email, subject, snippet, body_text, amount, title, attachments').eq('kind', 'invoice').is('undone_at', null).order('internal_date').limit(200);
  const out = { read: 0, failed: 0, waiting: 0 };
  for (const m of (mails || []) as Record<string, unknown>[]) {
    if (seen.has(m.id as number)) continue;
    if (Date.now() - started > budget) { out.waiting++; continue; }
    const text = 'From: ' + (m.from_name || '') + ' <' + (m.from_email || '') + '>\nDate: ' + String(m.internal_date || '').slice(0, 10) + '\nSubject: ' + (m.subject || '') + '\n\n' + String(m.body_text || m.snippet || '').slice(0, 3500);
    const atts = Array.isArray(m.attachments) ? (m.attachments as { filename?: string; mime?: string }[]) : [];
    const row: Record<string, unknown> = { source: 'email', hub_mail_id: m.id, name: String(m.subject || m.title || 'Email').slice(0, 200), mime: atts.find(a => a.mime === 'application/pdf') ? 'application/pdf' : null, folder_path: 'Hub inbox', fiscal_year: fyLabel(fyOfDate(new Date(String(m.internal_date)), cfg.fy_end_month)) };
    try {
      const r = await readWithModel([{ type: 'text', text: 'An email filed by the Hub inbox as a money email. Attachments: ' + (atts.map(a => a.filename).join(', ') || 'none') + '.\n\n' + text }]);
      const f = fields(r);
      const kind = ['payment_declined', 'transfer_notice', 'incoming_funds'].includes(r.doc_type) ? 'notice' : 'bill';
      const { error } = await svc.from('finance_docs').insert({ ...row, ...f, kind, doc_date: f.doc_date || String(m.internal_date || '').slice(0, 10), suggestion_note: JSON.stringify({ purpose: r.purpose || null, paid_by: null }) });
      if (error) throw new Error(error.message);
      out.read++;
    } catch (e) {
      await svc.from('finance_docs').insert({ ...row, kind: 'bill', read_state: 'failed', read_error: String((e as Error).message || e).slice(0, 300) });
      out.failed++;
    }
  }
  return out;
}

/* ---------- suggestions: names, moves, and saving email bills into Drive ---------- */
function cleanPart(s: string) { return s.replace(/[\\/:*?"<>|#%]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40); }
function extOf(name: string, mime: string | null) { const m = /\.(pdf|png|jpe?g|heic|webp)$/i.exec(name.trim()); if (m) return '.' + m[1].toLowerCase(); return mime === 'image/png' ? '.png' : mime === 'image/jpeg' ? '.jpg' : '.pdf'; }
/* only an all-lower-case vendor gets capitals; "Registraire des entreprises" stays as written */
function titleCase(s: string) { return s === s.toLowerCase() ? s.replace(/\b([a-z])/g, (c) => c.toUpperCase()) : s; }
function money(amount: number, currency: string) { return (currency === 'USD' ? 'US$' : currency === 'EUR' ? 'EUR ' : '$') + amount.toFixed(2); }
async function suggest(tree: Tree, cfg: Cfg) {
  await svc.rpc('finance_group_docs');
  const { data: docs } = await svc.from('finance_docs').select('*').eq('read_state', 'read').eq('suggestion_state', 'none').in('kind', ['bill', 'reimbursement', 'donation', 'contract', 'statement']).order('doc_date');
  let n = 0;
  const contracts = tree.root.find(f => f.mimeType === FOLDER && /^contracts$/i.test(f.name.trim()));
  const groupsInDrive = new Set<string>();
  const { data: dg } = await svc.from('finance_docs').select('group_key').or('drive_file_id.not.is.null,suggestion_state.in.(pending,approved,applied)').not('group_key', 'is', null);
  for (const r of (dg || []) as { group_key: string }[]) groupsInDrive.add(r.group_key);
  // deno-lint-ignore no-explicit-any
  for (const d of (docs || []) as Record<string, any>[]) {
    let extra: { purpose?: string | null; paid_by?: string | null } = {};
    try { extra = JSON.parse(d.suggestion_note || '{}'); } catch (_) { extra = {}; }
    const want = d.doc_date && d.vendor && d.amount !== null && d.amount !== undefined
      ? d.doc_date + ' - ' + cleanPart(titleCase(String(d.vendor))) + (extra.purpose ? ' - ' + cleanPart(String(extra.purpose)) : '') + ' - ' + money(Number(d.amount), d.currency || 'CAD') + (extra.paid_by ? ' (paid by ' + cleanPart(String(extra.paid_by)) + ')' : '') + extOf(d.name, d.mime)
      : null;
    const notes: string[] = []; let folderId: string | null = null; let folderName: string | null = null; let name: string | null = null;
    const fy = d.doc_date ? fyOfDate(new Date(d.doc_date + 'T12:00:00Z'), cfg.fy_end_month) : null;
    if (d.source === 'drive') {
      if (d.kind === 'contract') {
        if (!/^contracts/i.test(String(d.folder_path || ''))) { folderId = contracts?.id || null; folderName = 'Contracts'; notes.push('A contract, not a bill: contracts live together at the top of the Accounting drive' + (contracts ? '.' : ' (the folder is created when you approve).')); }
      } else if (d.kind === 'statement') {
        if (fy && kindOfPath(String(d.folder_path || '').split(' / ').slice(1).join(' / ')) !== 'statement') {
          const t = targetFor(tree, fy, 'statement');
          if (t) { folderId = t.id; folderName = t.name; notes.push('A bank statement: it belongs with the others in ' + t.name + (t.id ? '.' : ' (the folder is created when you approve).')); }
        }
      } else if (fy && !new RegExp('year\\s*end\\s*' + fy, 'i').test(String(d.folder_path || ''))) {
        const t = targetFor(tree, fy, d.kind);
        if (t) { folderId = t.id; folderName = t.name; notes.push('Dated ' + d.doc_date + ', which falls in ' + t.name.split(' / ')[0] + '.'); }
      }
      if (want && want !== String(d.name).trim() && d.kind !== 'contract' && d.kind !== 'statement') { name = want; notes.push('A name with the date, who and how much, so the folder sorts itself.'); }
    } else if (d.source === 'email' && d.mime === 'application/pdf' && ['invoice', 'receipt', 'bill'].includes(d.doc_type) && d.group_key && !groupsInDrive.has(d.group_key) && fy && want) {
      const t = targetFor(tree, fy, 'bill');
      if (t) { folderId = t.id; folderName = t.name; name = want; notes.push('Save the PDF from this email into ' + t.name.split(' / ').slice(-1)[0] + (t.id ? '' : ' (created when you approve)') + ' so Drive has every bill.'); groupsInDrive.add(d.group_key); }
    }
    if (!name && !folderName) { await svc.from('finance_docs').update({ suggestion_note: null }).eq('id', d.id); continue; }
    await svc.from('finance_docs').update({ suggested_name: name, suggested_folder_id: folderId, suggested_folder_name: folderName, suggestion_note: notes.join(' '), suggestion_state: 'pending', updated_at: new Date().toISOString() }).eq('id', d.id);
    n++;
  }
  return n;
}

/* ---------- apply what a person approved ---------- */
async function apply(tok: string, cfg: Cfg, who: string) {
  const { data: docs } = await svc.from('finance_docs').select('*').eq('suggestion_state', 'approved').limit(50);
  const out = { applied: 0, failed: [] as string[] };
  // deno-lint-ignore no-explicit-any
  for (const d of (docs || []) as Record<string, any>[]) {
    try {
      let target: string | null = d.suggested_folder_id || null;
      if (!target && d.suggested_folder_name) target = await ensurePath(tok, cfg, d.suggested_folder_name);
      if (d.source === 'drive') {
        const p = new URLSearchParams({ supportsAllDrives: 'true', fields: 'id,name,webViewLink' });
        if (target && target !== d.folder_id) { p.set('addParents', target); if (d.folder_id) p.set('removeParents', d.folder_id); }
        const r = await fetch(DRIVE + '/files/' + d.drive_file_id + '?' + p, { method: 'PATCH', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify(d.suggested_name ? { name: d.suggested_name } : {}) });
        const b = await r.json(); if (!b.id) throw new Error(String(b.error?.message || r.status).slice(0, 200));
        await svc.from('finance_docs').update({ name: b.name, folder_id: target || d.folder_id, folder_path: d.suggested_folder_name || d.folder_path, url: b.webViewLink || d.url, suggestion_state: 'applied', updated_at: new Date().toISOString() }).eq('id', d.id);
      } else {
        const { data: m } = await svc.from('hub_mail').select('attachments').eq('id', d.hub_mail_id).maybeSingle();
        const atts = ((m?.attachments || []) as { filename?: string; mime?: string; path?: string }[]).filter(a => a.mime === 'application/pdf' && a.path);
        const att = atts.find(a => /invoice|receipt|bill/i.test(a.filename || '')) || atts[0];
        if (!att || !target) throw new Error('No PDF, or no BILLS folder to save into');
        const { data: blob, error } = await svc.storage.from('hub-mail').download(att.path!);
        if (error || !blob) throw new Error('attachment: ' + (error?.message || 'missing'));
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const boundary = 'wa300' + crypto.randomUUID();
        const enc = new TextEncoder();
        const head = enc.encode('--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify({ name: d.suggested_name, parents: [target] }) + '\r\n--' + boundary + '\r\nContent-Type: application/pdf\r\n\r\n');
        const tail = enc.encode('\r\n--' + boundary + '--');
        const body = new Uint8Array(head.length + bytes.length + tail.length); body.set(head, 0); body.set(bytes, head.length); body.set(tail, head.length + bytes.length);
        const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'multipart/related; boundary=' + boundary }, body });
        const b = await r.json(); if (!b.id) throw new Error(String(b.error?.message || r.status).slice(0, 200));
        await svc.from('finance_docs').update({ drive_file_id: b.id, url: b.webViewLink || null, folder_id: target, folder_path: d.suggested_folder_name, suggestion_state: 'applied', updated_at: new Date().toISOString() }).eq('id', d.id);
      }
      try { await svc.from('change_log').insert({ entity_type: 'finance_doc', entity_id: String(d.id), field: 'drive', old_value: d.name, new_value: (d.suggested_name || d.name) + (d.suggested_folder_name ? ' in ' + d.suggested_folder_name : ''), changed_by: who }); } catch (_) { /* audit */ }
      out.applied++;
    } catch (e) {
      await svc.from('finance_docs').update({ suggestion_state: 'failed', suggestion_note: String(d.suggestion_note || '') + ' Failed: ' + String((e as Error).message || e).slice(0, 200) }).eq('id', d.id);
      out.failed.push(d.name);
    }
  }
  return out;
}

async function status() {
  const { data } = await svc.from('finance_docs').select('kind, match_state, suggestion_state, read_state');
  const c: Record<string, number> = {};
  for (const r of (data || []) as Record<string, string>[]) for (const k of ['kind', 'match_state', 'suggestion_state', 'read_state']) { const key = k + ':' + r[k]; c[key] = (c[key] || 0) + 1; }
  const { data: runs } = await svc.from('finance_drive_runs').select('*').order('id', { ascending: false }).limit(5);
  return { counts: c, runs };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const caller = await authorize(req);
  if (!caller) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || 'status');
  if (action === 'status') return json(await status());
  const started = Date.now();
  const { data: run } = await svc.from('finance_drive_runs').insert({ caller: caller.who, action }).select('id').single();
  const summary: Record<string, unknown> = {};
  try {
    const cfg = await config();
    const tok = await gtoken(cfg, action === 'apply');
    const tree = (action === 'match' || action === 'balances') ? { root: [], years: {} } as Tree : await loadTree(tok, cfg);
    if (action === 'run' || action === 'scan') {
      summary.scan = await scan(tok, cfg, tree, body.years === 'all');
      summary.statements = await statements(tok, Number(body.max_imports ?? 1), started);
    }
    if (action === 'run' || action === 'read') summary.drive_read = await readDrive(tok, started, Number(body.budget_ms ?? 110000));
    if (action === 'run' || action === 'emails') summary.email_read = await readEmails(cfg, started, Number(body.budget_ms ?? 120000));
    if (['run', 'read', 'emails', 'suggest', 'scan'].includes(action)) summary.suggested = await suggest(tree, cfg);
    if (action === 'apply') summary.apply = await apply(tok, cfg, caller.who);
    if (action === 'balances') summary.balances = await balances(tok, started, Number(body.budget_ms ?? 100000), Number(body.max ?? 12));
    if (action === 'run') summary.balances = await balances(tok, started, 140000, 3);
    if (['run', 'scan', 'read', 'emails', 'match', 'suggest'].includes(action)) { const { data: n } = await svc.rpc('finance_match_docs', { p_only: null }); summary.matched_checked = n; }
    await svc.from('finance_drive_runs').update({ finished_at: new Date().toISOString(), summary }).eq('id', run?.id);
    return json({ ok: true, ms: Date.now() - started, ...summary });
  } catch (e) {
    const msg = String((e as Error).message || e).slice(0, 400);
    await svc.from('finance_drive_runs').update({ finished_at: new Date().toISOString(), summary, error: msg }).eq('id', run?.id);
    return json({ error: msg, ...summary }, 500);
  }
});
