// v11 (14/10/26, wave237): meetings come from Loom only. Steel: "we should only be reading from Loom, not Read AI or Otter AI. Those
// are no longer supposed to be added to the meetings." A meeting recap email is no longer filed as a transcript of its own: a Loom
// recap hands its recording's id to loom-pull ({action: 'pull'}), which files the full transcript once by the pull's rules (filed.type
// 'loom', with the pull's answer: filed, waiting, needs_look, skipped); a recap from Read AI, Otter, Fireflies, tl;dv, Plaud or Fathom
// is ignored (filed.type 'recap_skipped', the email labelled Hub/Ignored, no Slack line). Before this every team meeting was processed
// two or three times (the Loom recap, the Read AI recap, then the Loom transcript two days later), which doubled its tasks.
// v10 (30/09/26, wave170): mail sent to info@ (which forwards to hub@) is passed on to the team or the person who should handle
// it with one line saying what to do (routeInfo: the model picks the team and, when a role clearly fits, the person, and writes the
// ask; hub_mail.mailbox info, ask, assignee, assignee_email); an info@ update is filed straight into the team's inbox (filed.type
// info, no team-page update) and team-inbox v1.3 always passes it on: a DM for a person, the channel for a team. When someone on the
// team is already on the email (they wrote it, or it was sent to them too), it is theirs and it is filed quietly (filed.on_thread):
// no ping for a thread they are already in. Security mail (codes, password resets, sign-in and security alerts: the subject decides)
// is never filed or passed on, whichever address it came to. Steel:
// "with info@welfareavenue.com we get a few emails there as well that needs to forwarded to the correct groups and individuals
// with a brief note of an ask of what they should take action on."
// v9 (29/09/26, wave164): Finance is its own team, apart from Fundraising. Steel: "all finance related emails like invoices, receipts,
// reimbursements should go straight to the finance slack channel not fundraising". Every money email (an invoice, a bill, a receipt, a
// payment notice or a failed payment, a reimbursement, a bank, card or tax notice) is kind invoice, department finance: a task on the
// Finance board (subsection Bills and receipts, titled Receipt:, Reimbursement:, Payment problem: or Invoice:), and team-inbox posts it
// in #accounting-finance. Fundraising keeps grants, donors, sponsors and events. Refiling as an invoice files it under Finance.
// v8 (25/09/26): a List-Unsubscribe header alone no longer marks mail as noise (Google Groups add one to real people's mail; bulk senders and mailing services still do); "Invitation with note" is calendar mail; applications match open positions in dept_requests (the table name was wrong). Filed emails now reach the team inbox, where Jev decides whether to ping the team (team-inbox).
// v6 (25/09/26): classifier routed through the Hub model router (llm, task mail_triage), Jev checks every filing (jevMail), job applications become candidates in Recruitment (fileApplication, label Hub/Recruitment).
// Welfare Avenue: mail-pull (v5, 25/09/26)
// v5: the hub@ mailbox shows the trail. Every processed email gets a Gmail
//   label (Hub/Filed, Hub/Needs a team, Hub/Ignored) through gmail.modify;
//   filed and ignored mail is marked read and archived out of the inbox, so
//   only what needs a human stays there. Undo puts the email back in the
//   inbox under Hub/Needs a team; refiling labels it Hub/Filed again. If the
//   modify scope is missing the sync still runs, just without labels.
// Reads the hub@welfareavenue.com inbox through the service account with
// Google Workspace domain-wide delegation (client id 107460787452614031265,
// scope gmail.readonly) and files what members cc the hub on. Steel: fully
// automatic, with an activity trail and an undo.
// Actions (POST {action}):
//   'probe'          : profile + labels + the newest messages (no writes)
//   'sync'           : pull new messages, classify, file (cron every 30 min)
//   'undo' {mail_id} : reverse what one email created; the row stays as 'undone'
//   'refile' {mail_id, kind?, department?} : undo then file again with overrides
//   'test' {from, subject, body, cc?, to?, dry_run?} : classify and file a made-up email (no Gmail); to info@ tests the passing on
// Filing rules (kind decided by the model, rules as fallback):
//   invoice          -> Finance task (dept_tasks, finance / Bills and receipts) with the
//                       attachments stored in the hub-mail bucket
//   meeting_summary  -> transcripts row + process-transcript (tasks, updates,
//                       decisions), unless the email is only a link
//   update           -> dept_updates entry on the team's page
//   noise            -> ignored (Google notices, calendar mail, newsletters)
// Every filing writes hub_mail.filed and a change_log row; Slack gets one line.
// Auth: staff JWT or x-wa-secret (cron via public.call_edge).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const HUB = 'hub@welfareavenue.com';
const BUCKET = 'hub-mail';
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

const DEPT_KEYS = ['opsmtl', 'progdev', 'opsto', 'marketing', 'fundraising', 'finance', 'hr', 'board'];
const DEPT_LABEL: Record<string, string> = {
  opsmtl: 'Operations Montreal', progdev: 'Program Development', opsto: 'Operations Toronto', marketing: 'Marketing',
  fundraising: 'Fundraising', finance: 'Finance', hr: 'Human Resources', board: 'Board & Governance',
};
const NOISE_SENDERS = /(no-?reply@accounts\.google\.com|mail-noreply@google\.com|chat-noreply@google\.com|calendar-notification@google\.com|drive-shares-noreply@google\.com|mailer-daemon|postmaster@|noreply@google\.com|workspace-noreply@google\.com)/i;
const CALENDAR_SUBJECT = /^(invitation|invitation with note|updated invitation|updated invitation with note|accepted|declined|tentatively accepted|canceled event|cancelled event|canceled event with note|cancelled event with note|new event|reminder):/i;
/* bulk senders: a List-Unsubscribe header alone is not enough (Google Groups add one to real people's mail) */
const BULK_SENDER = /(^|[._-])(no-?reply|newsletters?|mailer|notifications?|news|marketing|campaigns?|updates?|digest)@/i;
const BULK_ESP = /mailchimp|mcsv\.net|sendgrid|constantcontact|hubspot|klaviyo|substack|campaign-archive|mailerlite|sendinblue|brevo|convertkit|list-manage/i;
/* v10: security mail is never filed or passed on (a code or a reset link is for the account's owner only). The subject decides; the
   body counts only with a plain "your code is" (a meeting invite's "Passcode:" line is not security mail) */
const SECURITY = /\b(verification code|confirmation code|security code|login code|log[- ]in code|sign[- ]in code|one[- ]time (code|password|passcode|pin)|2-step verification|two[- ]factor|2fa|security alert|new sign[- ]in|sign[- ]in attempt|password (has been |was )?(reset|changed)|reset your password|password reset|verify your (email|account|identity|device|login)|your code is)\b/i;
const SECURITY_BODY = /\b(your (verification|security|confirmation|one[- ]time|login|log[- ]in|sign[- ]in) code is|use (this|the following) code to (sign|log|verify|confirm|reset))\b/i;
function isSecurity(subject: string, body: string): boolean { return SECURITY.test(subject) || SECURITY_BODY.test(body.slice(0, 1500)); }
const INFO = /(^|[\s<,;"'])info@welfareavenue\.com/i;

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}
async function staffEmail(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  return email.endsWith('@welfareavenue.com') || email === 'steelmacdonald@gmail.com' ? email : null;
}
async function siteUrl(): Promise<string> {
  const { data } = await svc.from('app_config').select('value').eq('key', 'site_url').maybeSingle();
  return String((data?.value as string) || 'https://wa-exec-dashboard.netlify.app').replace(/\/+$/, '');
}
async function postSlack(text: string) {
  try {
    const url = await getSecret('SLACK_WEBHOOK_URL');
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
  } catch (e) { console.error('slack post failed', e); }
}
async function log(entityId: string, field: string, oldV: string | null, newV: string | null, by = 'Hub inbox') {
  try { await svc.from('change_log').insert({ entity_type: 'hub_mail', entity_id: entityId, field, old_value: oldV, new_value: newV ? newV.slice(0, 400) : null, changed_by: by }); } catch (_) { /* audit */ }
}

/* ---- delegated Google token: the service account acts as hub@ ---- */
function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s: string): Uint8Array {
  const b = (s || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = b.length % 4 ? '='.repeat(4 - (b.length % 4)) : '';
  const raw = atob(b + pad);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
function pemToDer(pem: string): Uint8Array {
  const body = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const raw = atob(body);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
const TOKENS: Record<string, { value: string; exp: number }> = {};
async function delegatedToken(scope = 'https://www.googleapis.com/auth/gmail.readonly'): Promise<{ token: string; sa: string }> {
  const sa = JSON.parse(await getSecret('GOOGLE_SA_KEY'));
  const cached = TOKENS[scope];
  if (cached && Date.now() < cached.exp - 60000) return { token: cached.value, sa: sa.client_email };
  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64url(enc.encode(JSON.stringify({ iss: sa.client_email, sub: HUB, scope, aud: sa.token_uri, iat: now, exp: now + 3600 })));
  const signingInput = header + '.' + claims;
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key).buffer as ArrayBuffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(signingInput)));
  const assertion = signingInput + '.' + b64url(sig);
  const res = await fetch(sa.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
  const body = await res.json();
  if (!body.access_token) throw new Error('delegation failed: ' + JSON.stringify(body).slice(0, 300));
  TOKENS[scope] = { value: body.access_token, exp: Date.now() + (body.expires_in || 3600) * 1000 };
  return { token: TOKENS[scope].value, sa: sa.client_email };
}
/* ---- labels in the hub@ mailbox (gmail.modify; silent when the scope is missing) ---- */
const LABELS: Record<string, { name: string; bg: string; fg: string }> = {
  filed: { name: 'Hub/Filed', bg: '#16a765', fg: '#ffffff' },
  needs: { name: 'Hub/Needs a team', bg: '#ffad47', fg: '#000000' },
  ignored: { name: 'Hub/Ignored', bg: '#cccccc', fg: '#000000' },
  recruit: { name: 'Hub/Recruitment', bg: '#4986e7', fg: '#ffffff' },
};
let LABEL_IDS: Record<string, string> | null = null;
let MODIFY_TOKEN: string | null | undefined = undefined;
async function modifyToken(): Promise<string | null> {
  if (MODIFY_TOKEN !== undefined) return MODIFY_TOKEN;
  try { MODIFY_TOKEN = (await delegatedToken('https://www.googleapis.com/auth/gmail.modify')).token; }
  catch (e) { console.error('gmail.modify not available yet', String(e).slice(0, 200)); MODIFY_TOKEN = null; }
  return MODIFY_TOKEN;
}
// deno-lint-ignore no-explicit-any
async function gmailWrite(token: string, method: string, path: string, payload: unknown): Promise<any> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me' + path, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const b = await res.json().catch(() => null);
  if (!res.ok) throw new Error('gmail ' + method + ' ' + path + ' -> ' + res.status + ' ' + JSON.stringify(b).slice(0, 200));
  return b;
}
async function labelIds(token: string): Promise<Record<string, string>> {
  if (LABEL_IDS) return LABEL_IDS;
  const list = await gmail(token, '/labels');
  const byName: Record<string, string> = {};
  // deno-lint-ignore no-explicit-any
  ((list.labels || []) as any[]).forEach(l => { byName[String(l.name)] = String(l.id); });
  /* Gmail nests "Hub/Filed" under a "Hub" label: make the parent first */
  if (!byName['Hub']) { try { const p = await gmailWrite(token, 'POST', '/labels', { name: 'Hub', labelListVisibility: 'labelShow', messageListVisibility: 'show' }); byName['Hub'] = String(p.id); } catch (_) { /* may exist */ } }
  const out: Record<string, string> = {};
  for (const key of Object.keys(LABELS)) {
    const def = LABELS[key];
    if (!byName[def.name]) {
      let made = null;
      try { made = await gmailWrite(token, 'POST', '/labels', { name: def.name, labelListVisibility: 'labelShow', messageListVisibility: 'show', color: { backgroundColor: def.bg, textColor: def.fg } }); }
      catch (_) { made = await gmailWrite(token, 'POST', '/labels', { name: def.name, labelListVisibility: 'labelShow', messageListVisibility: 'show' }); }
      byName[def.name] = String(made.id);
    }
    out[key] = byName[def.name];
  }
  LABEL_IDS = out;
  return out;
}
/* outcome: 'filed' (read + archived), 'needs' (stays in the inbox, unread), 'ignored' (read + archived), 'undo' (back in the inbox as needs) */
async function labelMessage(gmailId: string, outcome: 'filed' | 'needs' | 'ignored' | 'undo' | 'recruit'): Promise<boolean> {
  if (!gmailId || gmailId.startsWith('test-') || gmailId.startsWith('person:')) return false;   /* v10: sent on from someone's own inbox: not in hub@ */
  const token = await modifyToken(); if (!token) return false;
  try {
    const ids = await labelIds(token);
    const all = [ids.filed, ids.needs, ids.ignored, ids.recruit];
    let add: string[] = [], remove: string[] = [];
    if (outcome === 'filed') { add = [ids.filed]; remove = all.filter(x => x !== ids.filed).concat(['UNREAD', 'INBOX']); }
    else if (outcome === 'recruit') { add = [ids.recruit]; remove = all.filter(x => x !== ids.recruit).concat(['UNREAD', 'INBOX']); }
    else if (outcome === 'ignored') { add = [ids.ignored]; remove = all.filter(x => x !== ids.ignored).concat(['UNREAD', 'INBOX']); }
    else { add = [ids.needs, 'INBOX']; remove = all.filter(x => x !== ids.needs); if (outcome === 'undo') add.push('UNREAD'); }
    await gmailWrite(token, 'POST', '/messages/' + encodeURIComponent(gmailId) + '/modify', { addLabelIds: add, removeLabelIds: remove });
    return true;
  } catch (e) { console.error('label failed', gmailId, String(e).slice(0, 200)); return false; }
}
// deno-lint-ignore no-explicit-any
async function gmail(token: string, path: string): Promise<any> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me' + path, { headers: { Authorization: 'Bearer ' + token } });
  const b = await res.json().catch(() => null);
  if (!res.ok) throw new Error('gmail ' + path.split('?')[0] + ' -> ' + res.status + ' ' + JSON.stringify(b).slice(0, 200));
  return b;
}
// deno-lint-ignore no-explicit-any
function hdr(msg: any, name: string): string {
  const hs = (msg && msg.payload && msg.payload.headers) || [];
  // deno-lint-ignore no-explicit-any
  const h = hs.find((x: any) => String(x.name).toLowerCase() === name.toLowerCase());
  return h ? String(h.value) : '';
}
function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
}
type Att = { filename: string; mime: string; size: number; attachmentId: string; path?: string };
// deno-lint-ignore no-explicit-any
function walk(part: any, out: { text: string[]; html: string[]; atts: Att[] }) {
  if (!part) return;
  const mime = String(part.mimeType || '');
  const filename = String(part.filename || '');
  if (filename && part.body && part.body.attachmentId) {
    out.atts.push({ filename, mime, size: Number(part.body.size || 0), attachmentId: part.body.attachmentId });
  } else if (part.body && part.body.data) {
    const txt = new TextDecoder().decode(fromB64url(part.body.data));
    if (mime === 'text/plain') out.text.push(txt); else if (mime === 'text/html') out.html.push(txt);
  }
  (part.parts || []).forEach((p: unknown) => walk(p, out));
}
function parseAddr(s: string): { email: string; name: string } {
  const m = String(s || '').match(/^(.*?)<([^>]+)>\s*$/);
  if (m) return { name: m[1].replace(/^"|"$/g, '').trim(), email: m[2].trim().toLowerCase() };
  return { name: '', email: String(s || '').trim().toLowerCase() };
}
function shortDate(d: Date): string { return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'America/Toronto' }); }
function safeName(s: string): string { return String(s || 'file').replace(/[^\w.\-]+/g, '_').slice(0, 120); }

/* ---- classification ---- */
type Candidate = { name: string; email: string | null; phone: string | null; role: string | null; links: string[] };
type Cls = { kind: 'invoice' | 'meeting_summary' | 'update' | 'noise' | 'application'; department: string | null; candidate?: Candidate | null; title: string; summary: string; amount: number | null; due_date: string | null; meeting_date: string | null; vendor: string | null; confidence: number; reason: string };
type Roster = Array<{ name: string; email: string | null; department: string | null }>;

function rulesClassify(m: { from_email: string; subject: string; body_text: string; attachments: Att[]; links: string[]; cc_list: string; to_list: string }, roster: Roster): Cls {
  const subj = m.subject || '', body = (m.body_text || '').slice(0, 4000), text = (subj + '\n' + body).toLowerCase();
  const attNames = m.attachments.map(a => a.filename.toLowerCase()).join(' ');
  let department: string | null = null;
  const senderRow = roster.find(r => r.email && r.email.toLowerCase() === m.from_email);
  if (senderRow && senderRow.department && DEPT_KEYS.includes(senderRow.department)) department = senderRow.department; /* wave137: exec (the co-executive directors) is not a team */
  if (!department) {
    const addrs = (m.to_list + ',' + m.cc_list).toLowerCase();
    const hit = roster.find(r => r.email && addrs.includes(r.email.toLowerCase()) && r.department && DEPT_KEYS.includes(r.department));
    if (hit) department = hit.department;
  }
  const kw: Array<[string, RegExp]> = [
    ['finance', /invoice|facture|receipt|re[cç]u\b|reimburs|rembours|budget|quickbooks|bookkeep|bank statement|payment|expense|purchase order/],
    ['fundraising', /grant|donor|donation|sponsor|fundrais/],
    ['hr', /hiring|recruit|onboard|policy|policies|payroll|job description|probation|interview/],
    ['marketing', /instagram|tiktok|linkedin|brand|website|newsletter|content|campaign|social media/],
    ['opsto', /toronto/],
    ['progdev', /program development|beneficiar|feedback system|curriculum|workshop/],
    ['opsmtl', /montreal|serving|volunteer|kitchen|inventory/],
    ['board', /board meeting|governance|bylaw|annual general/],
  ];
  if (!department) { const k = kw.find(x => x[1].test(text)); if (k) department = k[0]; }
  const amountM = text.match(/(?:\$|cad|usd)\s?([\d,]+(?:\.\d{2})?)/i) || text.match(/([\d,]+(?:\.\d{2})?)\s?(?:\$|cad)/i);
  const amount = amountM ? Number(String(amountM[1]).replace(/,/g, '')) : null;
  const isInvoice = /invoice|facture|receipt|re[cç]u|payment due|amount due|bill\b|statement of account|reimburs|rembours|payment (?:declined|failed|received)|card (?:was )?declined/.test(text) || /invoice|facture|receipt|recu/.test(attNames);
  const isSummary = /loom\.com|otter\.ai|fireflies|tl;dv|tldv|plaud|fathom/.test(text + ' ' + m.links.join(' ')) || /\b(recap|summary|meeting notes|transcript|minutes)\b/.test(subj.toLowerCase());
  const isApplication = /\b(resume|r\u00e9sum\u00e9|curriculum vitae|\bcv\b|cover letter|applying for|application for|apply for the|job application|internship|volunteer position)\b/i.test(subj + '\n' + body) || /resume|\bcv\b|cover/.test(attNames);
  const kind: Cls['kind'] = isInvoice ? 'invoice' : (isSummary ? 'meeting_summary' : (isApplication ? 'application' : 'update'));
  const first = body.split('\n').map(s => s.trim()).filter(Boolean)[0] || subj;
  if (kind === 'application') department = 'hr';
  if (kind === 'invoice') department = 'finance';   /* v9: every money email is Finance's */
  return { kind, department: department || null, candidate: kind === 'application' ? { name: m.from_email, email: m.from_email, phone: null, role: null, links: [] } : null, title: subj.slice(0, 90) || 'Email', summary: first.slice(0, 280), amount: kind === 'invoice' ? amount : null, due_date: null, meeting_date: null, vendor: null, confidence: 0.4, reason: 'rules' };
}

const MODELS = ['claude-haiku-4-5', 'claude-sonnet-4-5', 'claude-sonnet-5'];
const CLS_SYSTEM = `You file emails that Welfare Avenue staff cc to the shared hub@ inbox. Welfare Avenue is a charity serving people in need in Montreal and Toronto. Decide what each email is and which team it belongs to, then write a one line summary a busy executive can read in three seconds. Never use em dashes. Teams (use the key): opsmtl Operations Montreal (serving events, volunteers, kitchen, inventory), progdev Program Development (beneficiary programs, partnerships, research), opsto Operations Toronto, marketing (brand, social, website, content), fundraising (grants, donors, sponsorships, fundraising events), finance (the books: invoices, bills, receipts, payments, reimbursements, bank, card and tax notices, statements, budgets, bookkeeping), hr (hiring, onboarding, policies, people), board (governance). Finance is its own team, not part of fundraising.
Kinds: invoice = any money email the finance people handle: a bill, invoice, receipt, payment request or confirmation, a declined or failed payment, a reimbursement, a bank, card, payroll or tax notice, a statement (any team; department finance); meeting_summary = an AI meeting recap or transcript (Loom, Otter, Fireflies, tl;dv, Plaud, Fathom) or meeting notes with decisions and action items; application = a person applying for a job, internship, placement or volunteer role with us (a CV or resume attached, or a cover note; often sent to hub@ or forwarded from jobs@), department hr, and fill in candidate; update = anything else with substance about the work (a thread the team wants on record); noise = automated notices, calendar mail, newsletters, marketing blasts, receipts for nothing, empty forwards. Prefer the team of the sender or of the colleagues on the thread; for invoices set vendor and the amount actually owed; dates in ISO.`;
const CLS_TOOL = {
  name: 'file_email',
  description: 'Classify one email for the hub.',
  input_schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['invoice', 'meeting_summary', 'update', 'noise', 'application'] },
      candidate: { type: ['object', 'null'], description: 'Only for kind application: the applicant', properties: { name: { type: 'string' }, email: { type: ['string', 'null'] }, phone: { type: ['string', 'null'] }, role: { type: ['string', 'null'], description: 'The position they are applying for, as they put it' }, links: { type: 'array', items: { type: 'string' }, description: 'LinkedIn, portfolio' } }, required: ['name'] },
      department: { type: ['string', 'null'], enum: [...DEPT_KEYS, null] },
      title: { type: 'string', description: 'Short label, at most 90 characters, no em dashes' },
      summary: { type: 'string', description: 'One or two sentences: what it is and what it asks for' },
      amount: { type: ['number', 'null'] }, vendor: { type: ['string', 'null'] }, due_date: { type: ['string', 'null'] }, meeting_date: { type: ['string', 'null'] },
      confidence: { type: 'number' }, reason: { type: 'string' }
    },
    required: ['kind', 'department', 'title', 'summary', 'amount', 'vendor', 'due_date', 'meeting_date', 'confidence', 'reason']
  }
};
async function modelClassify(m: { from_email: string; from_name: string; to_list: string; cc_list: string; subject: string; internal_date: string; body_text: string; attachments: Att[]; links: string[] }, roster: Roster): Promise<Cls> {
  const key = 'hub-router';
  const user = 'ROSTER (name, email, team key):\n' + roster.map(r => r.name + ' <' + (r.email || '') + '> ' + (r.department || '')).join('\n') +
    '\n\nEMAIL\nFrom: ' + m.from_name + ' <' + m.from_email + '>\nTo: ' + m.to_list + '\nCc: ' + m.cc_list + '\nDate: ' + m.internal_date + '\nSubject: ' + m.subject +
    '\nAttachments: ' + (m.attachments.map(a => a.filename + ' (' + a.mime + ', ' + a.size + ' bytes)').join('; ') || 'none') +
    '\nLinks: ' + (m.links.slice(0, 8).join(' ') || 'none') + '\n\nBODY:\n' + (m.body_text || '').slice(0, 7000);
  let lastErr = '';
  for (const model of MODELS) {
    const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'x-wa-task': 'mail_triage',
        'x-wa-caller': 'mail-pull',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model, max_tokens: 700, temperature: 0, system: CLS_SYSTEM, messages: [{ role: 'user', content: user }], tools: [CLS_TOOL], tool_choice: { type: 'tool', name: 'file_email' } })
    });
    if (res.ok) {
      const body = await res.json();
      // deno-lint-ignore no-explicit-any
      const tu = (body.content || []).find((c: any) => c.type === 'tool_use');
      if (tu?.input) {
        const i = tu.input as Record<string, unknown>;
        const kind = ['invoice', 'meeting_summary', 'update', 'noise', 'application'].includes(String(i.kind)) ? String(i.kind) as Cls['kind'] : 'update';
        const dep = kind === 'application' ? 'hr' : kind === 'invoice' ? 'finance' : (DEPT_KEYS.includes(String(i.department)) ? String(i.department) : null);
        const cnd = i.candidate && typeof i.candidate === 'object' ? i.candidate as Record<string, unknown> : null;
        const candidate: Candidate | null = kind === 'application' ? { name: String((cnd && cnd.name) || m.from_name || m.from_email).slice(0, 120), email: cnd && cnd.email ? String(cnd.email).slice(0, 160) : (m.from_email || null), phone: cnd && cnd.phone ? String(cnd.phone).slice(0, 40) : null, role: cnd && cnd.role ? String(cnd.role).slice(0, 120) : null, links: Array.isArray(cnd && cnd.links) ? (cnd!.links as unknown[]).map(String).slice(0, 5) : [] } : null;
        const cls: Cls = { kind, department: dep, candidate, title: String(i.title || m.subject || 'Email').replace(/—/g, ',').slice(0, 90), summary: String(i.summary || '').replace(/—/g, ',').slice(0, 600), amount: typeof i.amount === 'number' ? i.amount : null, vendor: i.vendor ? String(i.vendor).slice(0, 80) : null, due_date: /^\d{4}-\d{2}-\d{2}$/.test(String(i.due_date || '')) ? String(i.due_date) : null, meeting_date: /^\d{4}-\d{2}-\d{2}$/.test(String(i.meeting_date || '')) ? String(i.meeting_date) : null, confidence: Number(i.confidence || 0), reason: String(i.reason || '').slice(0, 300) };
        return await jevMail(cls, m);
      }
      lastErr = 'no tool_use';
      continue;
    }
    lastErr = res.status + ' ' + (await res.text()).slice(0, 200);
    if (res.status !== 404 && res.status !== 400) break;
  }
  throw new Error('classifier failed: ' + lastErr);
}

/* ---- v10: info@ mail: which team or person, and the one line they read first ---- */
type FullRoster = Array<{ name: string; email: string | null; department: string | null; role: string | null }>;
type Route = { department: string | null; person: { name: string; email: string } | null; ask: string };
const ROUTE_TOOL = {
  name: 'pass_on',
  description: 'Who at Welfare Avenue should handle an email sent to info@, and the one line they read first.',
  input_schema: {
    type: 'object',
    properties: {
      department: { type: ['string', 'null'], enum: [...DEPT_KEYS, null], description: 'The team that should handle it' },
      person: { type: ['string', 'null'], description: 'The email of the one person on the roster it is for, when their role clearly fits; null for the team' },
      ask: { type: 'string', description: 'One line, at most 160 characters, addressed to them: what they should do (reply, decide, book, pay, send), with the key detail (who, what, when). No em dashes.' },
      confidence: { type: 'number' }
    },
    required: ['department', 'person', 'ask', 'confidence']
  }
};
/* someone on the team already on the email (they wrote it, or it was sent to them too): it is theirs, and nobody needs a ping */
function onThread(m: { from_email: string; to_list: string; cc_list: string }, roster: FullRoster): { name: string; email: string } | null {
  const staff = roster.filter(r => r.email && String(r.email).toLowerCase() !== HUB && !/^info@/i.test(String(r.email)));
  const from = String(m.from_email || '').toLowerCase();
  const s = staff.find(r => String(r.email).toLowerCase() === from);
  if (s) return { name: s.name, email: from };
  const hay = (String(m.to_list || '') + ',' + String(m.cc_list || '')).toLowerCase();
  const r = staff.find(p => hay.indexOf(String(p.email).toLowerCase()) >= 0);
  return r ? { name: r.name, email: String(r.email).toLowerCase() } : null;
}
async function routeInfo(m: { from_email: string; from_name: string; subject: string; internal_date: string; body_text: string; attachments: Att[] }, cls: Cls, roster: FullRoster, already: { name: string; email: string } | null = null): Promise<Route | null> {
  try {
    const people = roster.filter(r => r.email);
    const system = 'Emails sent to info@welfareavenue.com, the public address of Welfare Avenue (a charity serving people in need in Montreal and Toronto), are passed on to the team or the person who should handle them, with one line saying what to do. Pick the team; pick one person only when their role clearly fits the email (from the roster with roles), else leave person null for the whole team. Teams: opsmtl Operations Montreal (servings, volunteers, kitchen), progdev Program Development (programs, community partners), opsto Operations Toronto, marketing (brand, social, website, media), fundraising (grants, donors, sponsors, events), finance (invoices, receipts, payments, reimbursements), hr (hiring, applicants, people), board (governance). Write the line as a colleague would: plain, kind, specific, starting with what to do. Never use em dashes.';
    const user = 'ROSTER (name, email, team, role):\n' + people.map(p => p.name + ' <' + p.email + '> ' + (p.department || '') + ' ' + (p.role || '')).join('\n')
      + '\n\nTHE EMAIL (sent to info@)\nFrom: ' + m.from_name + ' <' + m.from_email + '>\nDate: ' + m.internal_date + '\nSubject: ' + m.subject + '\nAttachments: ' + (m.attachments.map(a => a.filename).join(', ') || 'none')
      + '\nThe Hub filed it as: ' + cls.kind + (cls.department ? ' for ' + cls.department : '') + (cls.summary ? ' (' + cls.summary + ')' : '')
      + (already ? '\n' + already.name + ' <' + already.email + '> is already on this email thread: they are the person, and the line says where it stands for them.' : '')
      + '\n\nBODY:\n' + (m.body_text || '').slice(0, 5000);
    const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + SERVICE_KEY, 'x-wa-task': 'mail_triage', 'x-wa-caller': 'mail-pull', 'Content-Type': 'application/json' },
      body: JSON.stringify({ max_tokens: 500, temperature: 0, system, messages: [{ role: 'user', content: user }], tools: [ROUTE_TOOL], tool_choice: { type: 'tool', name: 'pass_on' } })
    });
    if (!res.ok) return null;
    const body = await res.json();
    // deno-lint-ignore no-explicit-any
    const tu = (body.content || []).find((c: any) => c.type === 'tool_use');
    if (!tu?.input) return null;
    const i = tu.input as Record<string, unknown>;
    const dep = DEPT_KEYS.includes(String(i.department)) ? String(i.department) : null;
    const pe = already ? people.find(p => String(p.email).toLowerCase() === already.email) : i.person ? people.find(p => String(p.email).toLowerCase() === String(i.person).toLowerCase()) : null;
    const ask = String(i.ask || '').replace(/\s*\u2014\s*/g, ', ').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!ask) return null;
    return { department: dep, person: pe ? { name: pe.name, email: String(pe.email).toLowerCase() } : null, ask };
  } catch (e) { console.error('routeInfo', String(e).slice(0, 200)); return null; }
}

/* ---- filing ---- */
type MailRow = { id: number; gmail_id: string; from_email: string; from_name: string; subject: string; body_text: string; attachments: Att[]; links: string[]; internal_date: string; kind: string; department: string | null; title: string; summary: string; amount: number | null; due_date: string | null; meeting_date: string | null; vendor?: string | null; candidate?: Candidate | null; mailbox?: string | null; on_thread?: string | null; forwarded_by?: string | null };

async function storeAttachments(token: string, row: MailRow): Promise<Att[]> {
  const out: Att[] = [];
  for (const a of row.attachments || []) {
    try {
      if (a.size > 15 * 1024 * 1024) { out.push(a); continue; }
      const data = await gmail(token, '/messages/' + row.gmail_id + '/attachments/' + a.attachmentId);
      const bytes = fromB64url(data.data || '');
      const path = row.id + '/' + safeName(a.filename);
      const up = await svc.storage.from(BUCKET).upload(path, bytes, { contentType: a.mime || 'application/octet-stream', upsert: true });
      if (up.error) throw up.error;
      out.push({ ...a, path });
    } catch (e) { console.error('attachment failed', a.filename, e); out.push(a); }
  }
  return out;
}

async function fileInvoice(token: string, row: MailRow, site: string): Promise<Record<string, unknown>> {
  const atts = await storeAttachments(token, row);
  await svc.from('hub_mail').update({ attachments: atts }).eq('id', row.id);
  const amountTxt = row.amount != null ? ' ($' + Number(row.amount).toLocaleString('en-CA', { maximumFractionDigits: 2 }) + ')' : '';
  const txt = ((row.title || '') + ' ' + (row.subject || '')).toLowerCase();
  const what = /reimburs|rembours/.test(txt) ? 'Reimbursement' : /declined|failed|past due|overdue|unpaid|action required/.test(txt) ? 'Payment problem' : /refund/.test(txt) ? 'Refund' : /receipt|re\u00e7u|recu\b|payment received|paid/.test(txt) ? 'Receipt' : /statement/.test(txt) ? 'Statement' : 'Invoice';
  const title = (what + ': ' + (row.vendor || row.title || row.subject || 'from ' + row.from_email)).slice(0, 200) + amountTxt;
  const big = row.amount != null && Number(row.amount) >= 1000;
  const note = [row.summary, 'From ' + (row.from_name ? row.from_name + ' ' : '') + '<' + row.from_email + '> via the hub inbox' + (atts.length ? '; attachments: ' + atts.map(a => a.filename).join(', ') : ''), site + '/#hubmail'].filter(Boolean).join(' ');
  const ins = await svc.from('dept_tasks').insert({
    department: 'finance', subsection: 'Bills and receipts', title, owner: '', status: 'Open', flag: big, priority: false, done: false, sort: 999,
    due_date: row.due_date, reason_category: big ? 'Budget or purchase' : null, reason_note: note.slice(0, 600),
    updated_by: 'Hub inbox', opened_at: new Date().toISOString(), updated_at: new Date().toISOString(), project_id: null
  }).select('id').single();
  if (ins.error) throw new Error('task insert failed: ' + ins.error.message);
  return { type: 'task', id: ins.data.id, department: 'finance', title, attachments: atts.filter(a => a.path).map(a => a.path) };
}

async function fileUpdate(row: MailRow, site: string): Promise<Record<string, unknown>> {
  if (!row.department) return { type: 'inbox', id: null, needs: 'department', title: row.title || row.subject, site };
  const dept = row.department;
  const when = shortDate(new Date(row.internal_date || Date.now()));
  const label = ('Email ' + when + (row.from_name ? ' (' + row.from_name.split(' ')[0] + ')' : '')).slice(0, 60);
  const link = (row.links || []).find(l => /loom\.com|otter\.ai|docs\.google|drive\.google|notion|canva/.test(l));
  const text = [row.title && row.title !== row.subject ? row.title + '. ' : '', row.summary || row.subject, link ? ' Link: ' + link : ''].join('').slice(0, 900);
  const ins = await svc.from('dept_updates').insert({ department: dept, entry_label: label, text, created_at: new Date().toISOString(), confidential: false, added_by: 'Hub inbox (' + row.from_email + ')' }).select('id').single();
  if (ins.error) throw new Error('update insert failed: ' + ins.error.message);
  return { type: 'update', id: ins.data.id, department: dept, title: row.title || row.subject, site };
}

/* v11 (wave237): the Loom recording a recap email is about */
function loomIdIn(texts: string[]): string | null {
  for (const t of texts) { const m = /loom\.com\/(?:share|embed)\/([0-9a-f]{32})/i.exec(String(t || '')); if (m) return m[1].toLowerCase(); }
  return null;
}
function recapSource(row: MailRow): string {
  const t = (row.from_email + ' ' + row.subject + ' ' + (row.links || []).join(' ') + ' ' + (row.body_text || '').slice(0, 4000)).toLowerCase();
  if (/read\.ai|invited to view this report|readai/.test(t)) return 'Read AI';
  if (/otter\.ai/.test(t)) return 'Otter';
  if (/fireflies/.test(t)) return 'Fireflies';
  if (/tldv|tl;dv/.test(t)) return 'tl;dv';
  if (/plaud/.test(t)) return 'Plaud';
  if (/fathom/.test(t)) return 'Fathom';
  return 'a meeting recap';
}
async function fileSummary(row: MailRow, site: string): Promise<Record<string, unknown>> {
  /* v11 (wave237): meetings come from Loom only. A Loom recap hands its recording to loom-pull (the full transcript, filed once by
     the pull's rules); any other recap is not filed. The old path (the recap's text as a transcript) is kept below for an email
     that is a transcript someone pasted with no recorder behind it (no recorder named, 300 characters or more, kind meeting_summary). */
  const loomId = loomIdIn([...(row.links || []), row.body_text || '']);
  if (loomId) {
    try {
      const secret = await getSecret('WA_TRIGGER_SECRET');
      const res = await fetch(SUPABASE_URL + '/functions/v1/loom-pull', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-wa-secret': secret, 'Authorization': 'Bearer ' + ANON_KEY, 'apikey': ANON_KEY }, body: JSON.stringify({ action: 'pull', loom_id: loomId, why: 'recap email' }) });
      const out = await res.json().catch(() => ({})) as Record<string, unknown>;
      return { type: 'loom', id: null, loom_id: loomId, status: String(out.status || (res.ok ? 'ok' : 'error')), transcript_id: out.transcript_id || null, reason: out.reason || out.error || null, department: out.department || row.department, title: row.title || row.subject, site };
    } catch (e) {
      return { type: 'loom', id: null, loom_id: loomId, status: 'error', reason: String(e).slice(0, 200), department: row.department, title: row.title || row.subject, site };
    }
  }
  const src = recapSource(row);
  if (src !== 'a meeting recap') return { type: 'recap_skipped', id: null, department: row.department, title: row.title || row.subject, reason: 'Meeting recaps come from Loom only (Steel, 14/10/26); this one is from ' + src, site };
  if (!row.department) return { type: 'inbox', id: null, needs: 'department', title: row.title || row.subject, site };
  const dept = row.department;
  const body = (row.body_text || '').trim();
  const link = (row.links || []).find(l => /loom\.com|otter\.ai|fireflies|tldv|plaud|fathom/.test(l)) || null;
  if (body.length < 300) return fileUpdate({ ...row, summary: (row.summary || 'Meeting recording shared') + (link ? '' : '') }, site);
  const ins = await svc.from('transcripts').insert({
    department: DEPT_LABEL[dept] || dept, meeting_date: row.meeting_date || String(row.internal_date || new Date().toISOString()).slice(0, 10),
    title: (row.title || row.subject || 'Meeting summary').slice(0, 200), body: body.slice(0, 120000), added_by: 'Hub inbox (' + row.from_email + ')',
    created_at: new Date().toISOString(), processed: false, source_url: link, board_only: dept === 'board'
  }).select('id').single();
  if (ins.error) throw new Error('transcript insert failed: ' + ins.error.message);
  try {
    const secret = await getSecret('WA_TRIGGER_SECRET');
    await fetch(SUPABASE_URL + '/functions/v1/process-transcript', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-wa-secret': secret }, body: JSON.stringify({ transcript_id: ins.data.id }) });
  } catch (e) { console.error('process-transcript call failed', e); }
  return { type: 'transcript', id: ins.data.id, department: dept, title: row.title || row.subject, site };
}

/* ---- job applications become candidates in Recruitment (25/09/26) ---- */
async function fileApplication(token: string, row: MailRow, site: string): Promise<Record<string, unknown>> {
  const atts = token ? await storeAttachments(token, row) : (row.attachments || []);
  if (token) await svc.from('hub_mail').update({ attachments: atts }).eq('id', row.id);
  const isDoc = (a: Att) => /pdf|word|officedocument|text/i.test(a.mime || '') || /\.(pdf|docx?|rtf|txt)$/i.test(a.filename || '');
  const cv = atts.find(a => a.path && isDoc(a) && /resume|résumé|\bcv\b|curriculum/i.test(a.filename || '')) || atts.find(a => a.path && isDoc(a)) || null;
  const c = row.candidate || { name: row.from_name || row.from_email, email: row.from_email, phone: null, role: null, links: [] };
  const name = (c.name || row.from_name || row.from_email || 'Applicant').trim().slice(0, 120);
  const email = (c.email || row.from_email || '').toLowerCase() || null;
  /* an open position that matches the role they name */
  let requestId: number | null = null;
  try {
    const { data: reqs } = await svc.from('dept_requests').select('id, title, done').eq('type_key', 'hiring-request').eq('done', false);
    const words = String(c.role || row.subject || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !/application|position|role|job|apply|applying|for|the|with|your|welfare|avenue/.test(w));
    let best: { id: number; score: number } | null = null;
    for (const r of (reqs || []) as Array<{ id: number; title: string }>) {
      const t = String(r.title || '').toLowerCase();
      const score = words.reduce((a, w) => a + (t.includes(w) ? 1 : 0), 0);
      if (score > 0 && (!best || score > best.score)) best = { id: r.id, score };
    }
    if (best) requestId = best.id;
  } catch (_) { /* optional */ }
  /* the same person applying twice within 90 days updates the earlier row */
  let existing: { id: number } | null = null;
  if (email) {
    const { data } = await svc.from('hub_candidates').select('id').eq('email', email).gte('created_at', new Date(Date.now() - 90 * 86400000).toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle();
    existing = data as { id: number } | null;
  }
  const rowOut = {
    name, email, phone: c.phone || null, role: c.role || null, request_id: requestId, source: 'email', mail_id: row.id, gmail_id: row.gmail_id,
    cv_path: cv ? cv.path : null, cv_name: cv ? cv.filename : null, links: (c.links || []).concat((row.links || []).filter(l => /linkedin|portfolio|github|behance|dribbble/i.test(l))).slice(0, 6),
    summary: (row.summary || row.subject || '').slice(0, 600), updated_at: new Date().toISOString(), updated_by: 'Hub inbox'
  };
  let id: number;
  if (existing) {
    const up = await svc.from('hub_candidates').update({ ...rowOut, notes: null }).eq('id', existing.id).select('id').single();
    if (up.error) throw new Error('candidate update failed: ' + up.error.message);
    id = up.data.id;
  } else {
    const ins = await svc.from('hub_candidates').insert({ ...rowOut, status: 'new', stage_at: new Date().toISOString() }).select('id').single();
    if (ins.error) throw new Error('candidate insert failed: ' + ins.error.message);
    id = ins.data.id;
  }
  await log('candidate:' + id, existing ? 'reapplied' : 'applied', null, name + (c.role ? ' for ' + c.role : '') + (cv ? ' (CV attached)' : ''));
  return { type: 'candidate', id, department: 'hr', title: name + (c.role ? ': ' + c.role : ''), request_id: requestId, cv: cv ? cv.path : null, site, updated: !!existing };
}

/* ---- Jev checks the filing (25/09/26) ----
   OpenRouter's decision model reads the same email and says whether the
   proposed kind and team are right. Strong disagreement sends the email to
   the Hub inbox for a person instead of filing it wrongly; a confident team
   from Jev fills in a missing team. Never blocks: any failure keeps the
   model's answer. */
async function jevMail(cls: Cls, m: { from_email: string; from_name: string; to_list: string; subject: string; body_text: string; attachments: Att[] }): Promise<Cls> {
  try {
    const teams: Record<string, string> = { opsmtl: 'Operations Montreal (serving events, volunteers, kitchen, inventory)', progdev: 'Program Development (beneficiary programs, partnerships, research)', opsto: 'Operations Toronto', marketing: 'Marketing (brand, social, website, content)', fundraising: 'Fundraising (grants, donors, sponsorships, fundraising events)', finance: 'Finance (the books: invoices, receipts, payments, reimbursements, statements, budgets)', hr: 'HR (hiring, onboarding, policies, people)', board: 'Board (governance)', unsure: 'Cannot tell from the email' };
    const kinds: Record<string, string> = { invoice: 'a money email: a bill, invoice, receipt, payment notice, failed payment or reimbursement', meeting_summary: 'an AI meeting recap, transcript or meeting notes', application: 'a person applying for a job, internship or volunteer role', update: 'something with substance about the work worth putting on record', noise: 'automated notices, newsletters, calendar mail, empty forwards' };
    const state = { email: { from: m.from_name + ' <' + m.from_email + '>', to: m.to_list, subject: m.subject, attachments: m.attachments.map(a => a.filename), body_excerpt: (m.body_text || '').slice(0, 2500) }, proposed: { kind: cls.kind, team: cls.department, title: cls.title, summary: cls.summary }, teams };
    const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + SERVICE_KEY, 'x-wa-task': 'mail_triage', 'x-wa-caller': 'mail-pull', 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, questions: {
        agree: { type: 'noul', instructions: 'Is the proposed filing (kind and team) right for this email?' },
        kind: { type: 'choice', instructions: 'What is this email?', criteria: kinds },
        team: { type: 'choice', instructions: 'Which team should this be filed under?', criteria: teams },
      } })
    });
    if (!res.ok) return cls;
    const out = await res.json();
    const a = out?.answers || {};
    const agree = typeof a.agree?.noul === 'number' ? a.agree.noul : null;
    const jk = String(a.kind?.choice || ''); const jkConf = typeof a.kind?.confidence === 'number' ? a.kind.confidence : 0;
    const jt = String(a.team?.choice || ''); const jtConf = typeof a.team?.confidence === 'number' ? a.team.confidence : 0;
    const note = 'Jev: ' + (jk || '?') + '/' + (jt || '?') + (agree !== null ? ' (agree ' + Math.round(agree * 100) + '%)' : '');
    if (agree !== null && agree < 0.3 && jk && jk !== cls.kind && jkConf >= 0.7) {
      /* strong disagreement on what it is: do not file it as an invoice or an application on the model's word alone */
      if (cls.kind === 'invoice' || cls.kind === 'application' || jk === 'noise') { cls = { ...cls, kind: 'update', department: null, confidence: Math.min(cls.confidence, 0.3), reason: (cls.reason + ' | ' + note + ': sent to the inbox for a person').slice(0, 300) }; return cls; }
    }
    if (!cls.department && cls.kind !== 'noise' && cls.kind !== 'invoice' && jt && jt !== 'unsure' && DEPT_KEYS.includes(jt) && jtConf >= 0.75) {
      cls = { ...cls, department: jt, reason: (cls.reason + ' | team by ' + note).slice(0, 300) };
    } else if (agree !== null && agree < 0.3 && jt && jt !== 'unsure' && jt !== cls.department && jtConf >= 0.8 && cls.confidence < 0.8 && cls.kind !== 'invoice' && cls.kind !== 'application') {
      cls = { ...cls, department: null, confidence: Math.min(cls.confidence, 0.3), reason: (cls.reason + ' | ' + note + ': team unclear, sent to the inbox').slice(0, 300) };
    } else {
      cls = { ...cls, reason: (cls.reason + ' | ' + note).slice(0, 300) };
    }
    return cls;
  } catch (_) { return cls; }
}

async function fileOne(token: string, row: MailRow, site: string): Promise<Record<string, unknown>> {
  if (row.kind === 'application') return fileApplication(token, row, site);
  if (row.kind === 'invoice') return fileInvoice(token, row, site);
  if (row.kind === 'meeting_summary') return fileSummary(row, site);
  /* v10: an info@ email goes straight into the team's inbox, not onto the team page */
  if (row.mailbox === 'info') return row.department ? { type: 'info', id: null, department: row.department, title: row.title || row.subject, site, on_thread: row.on_thread || null } : { type: 'inbox', id: null, needs: 'department', title: row.title || row.subject, site };
  /* an email someone sent on from their inbox assistant stays that when it is moved to another team */
  if (row.mailbox === 'person') return { type: 'forward', id: null, department: row.department, by: row.forwarded_by || null, from: 'inbox assistant', site };
  return fileUpdate(row, site);
}

async function undoOne(mailId: number, by: string): Promise<Record<string, unknown>> {
  const { data: row } = await svc.from('hub_mail').select('*').eq('id', mailId).maybeSingle();
  if (!row) throw new Error('mail not found');
  const filed = (row.filed || {}) as Record<string, unknown>;
  const removed: string[] = [];
  if (filed.type === 'task' && filed.id) { await svc.from('dept_tasks').delete().eq('id', filed.id); removed.push('task ' + filed.id); }
  if (filed.type === 'update' && filed.id) { await svc.from('dept_updates').delete().eq('id', filed.id); removed.push('update ' + filed.id); }
  if (filed.type === 'candidate' && filed.id) { await svc.from('hub_candidates').delete().eq('id', filed.id); removed.push('candidate ' + filed.id); }
  if (filed.type === 'transcript' && filed.id) {
    const { data: tx } = await svc.from('transcripts').select('id, title').eq('id', filed.id).maybeSingle();
    if (tx) {
      const tag = 'AI: ' + tx.title;
      const t = await svc.from('dept_tasks').delete().eq('updated_by', tag).select('id');
      const u = await svc.from('dept_updates').delete().eq('added_by', tag).select('id');
      const d = await svc.from('decisions').delete().eq('raised_by', tag).eq('done', false).select('id');
      await svc.from('transcripts').delete().eq('id', tx.id);
      removed.push('transcript ' + tx.id + ' (' + ((t.data || []).length) + ' tasks, ' + ((u.data || []).length) + ' updates, ' + ((d.data || []).length) + ' decisions)');
    }
  }
  await svc.from('hub_mail').update({ status: 'undone', undone_at: new Date().toISOString(), undone_by: by }).eq('id', mailId);
  await log(String(mailId), 'undone', JSON.stringify(filed).slice(0, 200), removed.join(', ') || 'nothing to remove', by);
  await labelMessage(String(row.gmail_id || ''), 'undo');
  return { ok: true, removed };
}

/* ---- the sync ---- */
async function runSync(max = 40): Promise<Record<string, unknown>> {
  const { token } = await delegatedToken();
  const site = await siteUrl();
  const { data: st } = await svc.from('hub_mail_state').select('*').eq('id', 1).maybeSingle();
  const since = st?.last_internal_date ? new Date(new Date(st.last_internal_date).getTime() - 2 * 86400000) : new Date(Date.now() - 14 * 86400000);
  const q = 'after:' + Math.floor(since.getTime() / 1000) + ' -in:spam -in:trash -in:chats';
  const list = await gmail(token, '/messages?maxResults=' + max + '&q=' + encodeURIComponent(q));
  // deno-lint-ignore no-explicit-any
  const ids: string[] = ((list.messages || []) as any[]).map(m => String(m.id));
  let known = new Set<string>();
  if (ids.length) { const { data: have } = await svc.from('hub_mail').select('gmail_id').in('gmail_id', ids); known = new Set((have || []).map(h => h.gmail_id)); }
  const fresh = ids.filter(id => !known.has(id));
  const { data: rosterRows } = await svc.from('team_members').select('name, email, department, role').eq('active', true);
  const roster: Roster = (rosterRows || []) as Roster;
  const fullRoster = (rosterRows || []) as FullRoster;
  let filed = 0, ignored = 0, failed = 0, newest: string | null = st?.last_internal_date || null;
  const lines: string[] = [];
  for (const id of fresh.reverse()) {
    try {
      const m = await gmail(token, '/messages/' + id + '?format=full');
      const parsed = { text: [] as string[], html: [] as string[], atts: [] as Att[] };
      walk(m.payload, parsed);
      const bodyText = (parsed.text.join('\n').trim() || stripHtml(parsed.html.join('\n'))).slice(0, 60000);
      const from = parseAddr(hdr(m, 'From'));
      const internal = new Date(Number(m.internalDate || Date.now())).toISOString();
      const links = Array.from(new Set((bodyText.match(/https?:\/\/[^\s<>"')\]]+/g) || []).map(l => l.replace(/[.,;:]+$/, '')))).slice(0, 30);
      const base = { gmail_id: id, thread_id: m.threadId, internal_date: internal, from_email: from.email, from_name: from.name, to_list: hdr(m, 'To').slice(0, 1000), cc_list: hdr(m, 'Cc').slice(0, 1000), subject: hdr(m, 'Subject').slice(0, 500), snippet: String(m.snippet || '').slice(0, 300), body_text: bodyText, attachments: parsed.atts, links };
      const listUnsub = !!hdr(m, 'List-Unsubscribe');
      const bulk = listUnsub && !from.email.endsWith('@welfareavenue.com') && (BULK_SENDER.test(from.email) || BULK_ESP.test(hdr(m, 'List-Unsubscribe') + ' ' + hdr(m, 'List-Id') + ' ' + hdr(m, 'X-Mailer') + ' ' + hdr(m, 'Return-Path')) || /^bulk$/i.test(hdr(m, 'Precedence')));
      const isNoise = NOISE_SENDERS.test(from.email) || CALENDAR_SUBJECT.test(base.subject) || from.email === HUB || bulk || /^(welcome to chat|tips for using your new inbox|get the official gmail app)/i.test(base.subject);
      const security = isSecurity(base.subject, bodyText);   /* v10 */
      const toInfo = INFO.test([base.to_list, base.cc_list, hdr(m, 'X-Original-To'), hdr(m, 'X-Forwarded-For'), hdr(m, 'Delivered-To')].join(','));   /* v10 */
      let cls: Cls;
      if (isNoise || security) cls = { kind: 'noise', department: null, title: base.subject.slice(0, 90), summary: '', amount: null, due_date: null, meeting_date: null, vendor: null, confidence: 1, reason: security ? 'security mail: never filed or passed on' : 'system or calendar mail' };
      else {
        try { cls = await modelClassify(base, roster); } catch (e) { console.error('model classify failed', e); cls = rulesClassify(base, roster); }
      }
      /* v10: info@ mail is passed on to a team or a person with one line of what to do */
      let route: Route | null = null, already: { name: string; email: string } | null = null;
      if (toInfo && cls.kind !== 'noise') {
        already = onThread(base, fullRoster);
        route = await routeInfo(base, cls, fullRoster, already);
        if (route && route.department && (cls.kind === 'update' || cls.kind === 'meeting_summary' || !cls.department)) cls = { ...cls, department: route.department, reason: (cls.reason + ' | info@: ' + route.department + (route.person ? ' for ' + route.person.name : '')).slice(0, 300) };
      }
      const ins = await svc.from('hub_mail').insert({ ...base, kind: cls.kind, department: cls.department, title: cls.title, summary: cls.summary, amount: cls.amount, due_date: cls.due_date, meeting_date: cls.meeting_date, confidence: cls.confidence, reason: cls.reason, status: cls.kind === 'noise' ? 'ignored' : 'new',
        mailbox: toInfo ? 'info' : 'hub', ask: route ? route.ask : null, assignee: route && route.person ? route.person.name : null, assignee_email: route && route.person ? route.person.email : null }).select('id').single();
      if (ins.error) throw new Error('hub_mail insert failed: ' + ins.error.message);
      if (!newest || internal > newest) newest = internal;
      if (cls.kind === 'noise') { ignored++; await labelMessage(id, 'ignored'); continue; }
      const row: MailRow = { ...base, id: ins.data.id, kind: cls.kind, department: cls.department, title: cls.title, summary: cls.summary, amount: cls.amount, due_date: cls.due_date, meeting_date: cls.meeting_date, vendor: cls.vendor, candidate: cls.candidate || null, mailbox: toInfo ? 'info' : 'hub', on_thread: already ? already.name : null };
      try {
        const result = await fileOne(token, row, site);
        if (toInfo && already && !result.on_thread) result.on_thread = already.name;   /* v10: team-inbox files it quietly */
        /* v11 (wave237): a recap from anything but Loom is ignored, quietly */
        if (result.type === 'recap_skipped') {
          await svc.from('hub_mail').update({ filed: result, status: 'ignored', reason: String(result.reason || '').slice(0, 300) }).eq('id', row.id);
          await labelMessage(id, 'ignored');
          await log(String(row.id), 'ignored', null, String(result.reason || 'recap from another recorder').slice(0, 300));
          ignored++;
          continue;
        }
        await svc.from('hub_mail').update({ filed: result, status: 'filed' }).eq('id', row.id);
        await labelMessage(id, result.type === 'inbox' ? 'needs' : result.type === 'candidate' ? 'recruit' : 'filed');
        const where = result.type === 'candidate' ? 'Recruitment (HR centre)' : result.type === 'task' ? 'Finance task' : result.type === 'transcript' ? 'transcript pipeline' : result.type === 'loom' ? 'the Loom pull (' + String(result.status || '') + (result.transcript_id ? ', transcript ' + result.transcript_id : '') + ')' : result.type === 'inbox' ? 'the Hub inbox (no team yet)' : (DEPT_LABEL[String(result.department)] || String(result.department)) + ' update';
        await log(String(row.id), 'filed', null, cls.kind + ' -> ' + where + ': ' + (cls.title || base.subject));
        /* v11: the Loom pull's own processing posts the meeting's line; the recap email itself gets none */
        if (result.type !== 'loom') lines.push('*' + (cls.kind === 'invoice' ? 'Invoice' : cls.kind === 'meeting_summary' ? 'Meeting summary' : cls.kind === 'application' ? 'Job application' : 'Update') + '* from ' + (from.name || from.email) + ' filed as ' + where + ': ' + (cls.title || base.subject) + (cls.amount != null ? ' ($' + cls.amount + ')' : ''));
        filed++;
      } catch (e) {
        failed++;
        await svc.from('hub_mail').update({ status: 'failed', error: String(e).slice(0, 400) }).eq('id', row.id);
        await log(String(row.id), 'failed', null, String(e).slice(0, 300));
        await labelMessage(id, 'needs');
      }
    } catch (e) {
      failed++;
      console.error('message failed', id, e);
      try { await svc.from('hub_mail').upsert({ gmail_id: id, status: 'failed', error: String(e).slice(0, 400), kind: 'noise' }, { onConflict: 'gmail_id' }); } catch (_) { /* fine */ }
    }
  }
  const result = fresh.length + ' new, ' + filed + ' filed, ' + ignored + ' ignored, ' + failed + ' failed';
  await svc.from('hub_mail_state').upsert({ id: 1, last_sync_at: new Date().toISOString(), last_internal_date: newest, runs: (st?.runs || 0) + 1, last_result: result, last_error: null });
  if (lines.length) await postSlack(':inbox_tray: Hub inbox filed ' + filed + ' email' + (filed === 1 ? '' : 's') + ':\n' + lines.join('\n') + '\n' + site + '/#hubmail');
  return { checked: ids.length, fresh: fresh.length, filed, ignored, failed };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let caller = await staffEmail(req);
  if (!caller) {
    try { const g = req.headers.get('x-wa-secret'); if (g && g === (await getSecret('WA_TRIGGER_SECRET'))) caller = 'automation'; } catch (_) { /* no */ }
  }
  if (!caller) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || 'probe');
  /* audit 26/09/26: who may do what. probe (any Gmail search of the hub@ mailbox) and test: the pipeline and admins.
     undo and refile (they delete or move what an email created): leaders and admins, as the Hub inbox page. */
  if (caller !== 'automation' && ['probe', 'test', 'undo', 'refile'].includes(action)) {
    const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } });
    let admin = false, leader = false;
    try { const a = await asUser.rpc('is_hub_admin'); admin = a.data === true; } catch (_) { admin = false; }
    try { const l = await asUser.rpc('is_hub_leader'); leader = l.data === true; } catch (_) { leader = false; }
    if (!leader) { try { const pg = await asUser.rpc('wa_page_ok', { p_tab: 'hubmail' }); leader = pg.data === true; } catch (_) { /* no */ } }
    if ((action === 'probe' || action === 'test') && !admin) return json({ error: 'Only admins can use ' + action + '.' }, 403);
    if ((action === 'undo' || action === 'refile') && !admin && !leader) return json({ error: 'Only leaders and admins can ' + action + ' a filing.' }, 403);
  }
  try {
    if (action === 'probe') {
      const { token, sa } = await delegatedToken();
      const profile = await gmail(token, '/profile');
      const list = await gmail(token, '/messages?maxResults=' + Math.min(25, Number(body.max || 12)) + '&q=' + encodeURIComponent(String(body.q || '')));
      const rows: Record<string, unknown>[] = [];
      // deno-lint-ignore no-explicit-any
      for (const it of ((list.messages || []) as any[])) {
        const m = await gmail(token, '/messages/' + it.id + '?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Date');
        rows.push({ id: it.id, date: hdr(m, 'Date'), from: hdr(m, 'From'), to: hdr(m, 'To'), cc: hdr(m, 'Cc'), subject: hdr(m, 'Subject'), snippet: String(m.snippet || '').slice(0, 160), labels: m.labelIds || [] });
      }
      const mt = await modifyToken(); let labels: Record<string, string> | null = null; if (mt) { try { labels = await labelIds(mt); } catch (e) { labels = { error: String(e).slice(0, 200) }; } }
      return json({ ok: true, as: HUB, service_account: sa, email: profile.emailAddress, messages_total: profile.messagesTotal, threads_total: profile.threadsTotal, modify_scope: !!mt, labels, newest: rows });
    }
    if (action === 'sync') {
      if (body.wait === true) return json({ ok: true, ...(await runSync(Number(body.max || 40))) });
      const work = runSync(Number(body.max || 40)).catch(async (e) => { console.error('sync failed', e); await svc.from('hub_mail_state').upsert({ id: 1, last_sync_at: new Date().toISOString(), last_error: String(e).slice(0, 400) }); });
      // @ts-ignore EdgeRuntime provided by the Supabase edge runtime
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) { EdgeRuntime.waitUntil(work); } else { await work; }
      return json({ accepted: true }, 202);
    }
    if (action === 'test') {
      /* classify and file a made-up email (no Gmail); undo it with {action:'undo', mail_id} */
      const site = await siteUrl();
      const { data: rosterRows } = await svc.from('team_members').select('name, email, department, role').eq('active', true);
      const from = parseAddr(String(body.from || 'someone@example.com'));
      const bodyText = String(body.body || '').slice(0, 60000);
      const links = Array.from(new Set((bodyText.match(/https?:\/\/[^\s<>"')\]]+/g) || []).map(l => l.replace(/[.,;:]+$/, '')))).slice(0, 30);
      const toTest = String(body.to || HUB);   /* v10: to info@ tests the passing on */
      const base = { gmail_id: 'test-' + Date.now(), thread_id: null, internal_date: new Date().toISOString(), from_email: from.email, from_name: from.name, to_list: toTest, cc_list: String(body.cc || ''), subject: String(body.subject || 'Test'), snippet: bodyText.slice(0, 200), body_text: bodyText, attachments: [] as Att[], links };
      const security = isSecurity(base.subject, bodyText), toInfo = INFO.test(toTest + ',' + base.cc_list);
      let cls: Cls;
      if (security) cls = { kind: 'noise', department: null, title: base.subject.slice(0, 90), summary: '', amount: null, due_date: null, meeting_date: null, vendor: null, confidence: 1, reason: 'security mail: never filed or passed on' };
      else { try { cls = await modelClassify(base, (rosterRows || []) as Roster); } catch (e) { cls = rulesClassify(base, (rosterRows || []) as Roster); cls.reason = 'rules (' + String(e).slice(0, 120) + ')'; } }
      let route: Route | null = null;
      let already: { name: string; email: string } | null = null;
      if (toInfo && cls.kind !== 'noise') { already = onThread(base, (rosterRows || []) as FullRoster); route = await routeInfo(base, cls, (rosterRows || []) as FullRoster, already); if (route && route.department && (cls.kind === 'update' || cls.kind === 'meeting_summary' || !cls.department)) cls = { ...cls, department: route.department }; }
      const ins = await svc.from('hub_mail').insert({ ...base, kind: cls.kind, department: cls.department, title: cls.title, summary: cls.summary, amount: cls.amount, due_date: cls.due_date, meeting_date: cls.meeting_date, confidence: cls.confidence, reason: cls.reason, status: cls.kind === 'noise' ? 'ignored' : 'new', mailbox: toInfo ? 'info' : 'hub', ask: route ? route.ask : null, assignee: route && route.person ? route.person.name : null, assignee_email: route && route.person ? route.person.email : null }).select('id').single();
      if (ins.error) throw new Error(ins.error.message);
      if (cls.kind === 'noise' || body.dry_run === true) return json({ ok: true, mail_id: ins.data.id, classification: cls, route, on_thread: already ? already.name : null, filed: null });
      const result = await fileOne('', { ...base, id: ins.data.id, kind: cls.kind, department: cls.department, title: cls.title, summary: cls.summary, amount: cls.amount, due_date: cls.due_date, meeting_date: cls.meeting_date, vendor: cls.vendor, candidate: cls.candidate || null, mailbox: toInfo ? 'info' : 'hub', on_thread: already ? already.name : null }, site);
      await svc.from('hub_mail').update({ filed: result, status: 'filed' }).eq('id', ins.data.id);
      await log(String(ins.data.id), 'filed', null, 'test: ' + cls.kind + ' -> ' + String(result.type) + ' ' + String(result.id), caller);
      return json({ ok: true, mail_id: ins.data.id, classification: cls, filed: result });
    }
    if (action === 'undo') {
      const id = Number(body.mail_id); if (!id) return json({ error: 'mail_id required' }, 400);
      return json(await undoOne(id, caller));
    }
    if (action === 'refile') {
      const id = Number(body.mail_id); if (!id) return json({ error: 'mail_id required' }, 400);
      const { data: row } = await svc.from('hub_mail').select('*').eq('id', id).maybeSingle();
      if (!row) return json({ error: 'not found' }, 404);
      if (row.status === 'filed') await undoOne(id, caller);
      const kind = ['invoice', 'meeting_summary', 'update', 'application'].includes(String(body.kind)) ? String(body.kind) : (row.kind === 'noise' ? 'update' : row.kind);
      const department = kind === 'invoice' ? 'finance' : (DEPT_KEYS.includes(String(body.department)) ? String(body.department) : row.department);   /* v9: a money email is Finance's */
      const { token } = await delegatedToken();
      const site = await siteUrl();
      const result = await fileOne(token, { ...(row as MailRow), kind, department }, site);
      /* v10: an info@ email moved to another team is passed on to that team, not to the person it was first meant for */
      const moved = (row.mailbox === 'info' || row.mailbox === 'person') && department !== row.department ? { assignee: null, assignee_email: null } : {};
      await svc.from('hub_mail').update({ kind, department, filed: result, status: 'filed', error: null, undone_at: null, undone_by: null, ...moved }).eq('id', id);
      await labelMessage(String(row.gmail_id || ''), result.type === 'inbox' ? 'needs' : result.type === 'candidate' ? 'recruit' : 'filed');
      await log(String(id), 'refiled', row.kind + '/' + (row.department || ''), kind + '/' + (department || '') + ' -> ' + String(result.type) + ' ' + String(result.id), caller);
      return json({ ok: true, filed: result });
    }
    if (action === 'relabel') {
      /* one-off catch-up: label every email the hub has already processed */
      const { data: rows } = await svc.from('hub_mail').select('gmail_id, kind, status, filed').order('id', { ascending: true }).limit(Number(body.max || 300));
      let done = 0, skipped = 0;
      for (const r of (rows || [])) {
        const gid = String(r.gmail_id || ''); if (!gid || gid.startsWith('test-')) { skipped++; continue; }
        const filed = (r.filed || {}) as Record<string, unknown>;
        const outcome = r.status === 'undone' ? 'undo' : r.status === 'failed' ? 'needs' : r.kind === 'noise' ? 'ignored' : (filed.type === 'inbox' ? 'needs' : 'filed');
        if (await labelMessage(gid, outcome as 'filed')) done++; else skipped++;
      }
      return json({ ok: true, labelled: done, skipped, modify_scope: !!(await modifyToken()) });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 500) }, 500);
  }
});
