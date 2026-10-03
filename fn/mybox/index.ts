// Welfare Avenue: mybox (v1, 30/09/26, wave170): the inbox assistant, for a person's own mailbox.
// Steel (29/09/26): "review my steel.macdonald@welfareavenue.com emails as well and to start categorizing them in to my different
// folders, sending them to the necessary teams, and helping me draft replies in a reply tool that asks me questions to clarify how
// to respond to individuals the emailed me. It needs to use steel-voice and wa-writing to make sure replies sound like me. This is
// a tool I'd like to roll out to others later". His choices: it labels by itself (every 15 minutes); the rest waits for him; replies
// are Gmail drafts he sends himself; owner only; personal mail is skipped; an email he sends to a team lands in the team's Hub inbox
// and their Slack channel. v1.1 (30/09/26): the prompts are written for any owner (by name, not he), and a sensitive subject
// (health and care, support groups and fellowships, family law) is left alone for every owner before any model reads it.
// v1.2 (30/09/26): bulk and automated mail (a List-Unsubscribe header with a bulk sender, a mailing service or a bulk precedence)
// never waits on a personal reply. v1.3 (30/09/26): mail from a colleague (a welfareavenue.com address) is not offered to a team:
// it is already with one.
// v1.4 (03/10/26, wave201): Steel: "make sure /steel-writing:wa-writing skill is used as a framework to writing emails" and
// "make sure that drafts are actually saved. It didn't work last time". The owner's guide (mybox_owners.voice, Steel's: the
// wa-writing framework with steel-voice underneath, first line "FRAMEWORK: ...") leads every draft; the model names the reader
// (wa-writing's audiences) and the register before writing; figures come only from the owner, the thread or the Hub's verified
// fact base (fund_facts, status verified, budgets left out); a draft that still carries a banned phrase is revised once. A saved
// draft is read back from Gmail before the Hub says so (it must be a draft in the email's thread); saving again for the same email
// updates that draft instead of adding another; the link opens that draft in the owner's own account (authuser), not whichever
// Gmail the browser has first; change_log gets the ids, never the subject.
//
// Who: the mailbox's owner, signed in to the Hub (their Welfare Avenue address, or an alias of it in wa_email_aliases), with a
//   mybox_owners row that is on. The Hub's service account acts as them through Google Workspace domain-wide delegation
//   (gmail.modify: read, label, drafts). The trigger secret only runs the 15-minute sort (and a dry sort that returns no mail).
// Never: sends an email (a reply is a Gmail draft), deletes anything, keeps or reads personal mail (the owner's
//   never-read list first, no model involved; then the model's call; either way only the message id is kept), writes a subject
//   or a sender anywhere another person can read (change_log gets counts and ids only, unless the owner sends it to a team).
// Actions (POST {action}):
//   status                        the owner's settings and counts
//   labels {refresh?}             their own Gmail labels, with a few recent subjects each (what the sorting learns from)
//   settings {auto_sort?, days_back?, archive_labels?, label_notes?, skip_senders?, skip_words?, voice?}
//   voice                         the owner's own writing guide (wave201: Settings, Your writing guide)
//   sort                          sort new inbox mail now, in the background (the owner), or every owner with auto_sort on (the secret)
//   retry                         sort again what failed
//   open {gmail_id}               the email and its thread, read from Gmail (not kept)
//   questions {gmail_id}          what the reply tool needs to know first (up to three questions, with likely answers)
//   draft {gmail_id, answers[], note?}   a reply in the owner's voice (not kept until saved), with the framework, reader and register
//   save_draft {gmail_id, body, reply_all?}   a Gmail draft in the thread (the email's earlier draft updated if it is still there),
//                                 read back before answering; the owner sends it from Gmail
//   suggest_ask {gmail_id, team}  the one line a team would read, and who on the team it is for
//   to_team {gmail_id, team, ask, person?, dry_run?}   files it in the team's Hub inbox (hub_mail, mailbox person); team-inbox tells
//                                 them (dry_run: the row it would file, nothing written)
//   done {gmail_id, what}         reply_done | reply_dismiss | reply_reopen | team_dismiss | team_reopen
//   unlabel {gmail_id}            takes the assistant's label off (and puts it back in the inbox if it had left)
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

const TEAMS: Record<string, string> = {
  opsmtl: 'Operations Montreal', progdev: 'Program Development', opsto: 'Operations Toronto', marketing: 'Marketing',
  fundraising: 'Fundraising', finance: 'Finance', hr: 'Human Resources', board: 'Board & Governance',
};
const TEAM_WORK: Record<string, string> = {
  opsmtl: 'Operations Montreal: serving events, volunteers, the kitchen and cooks, drivers, inventory',
  progdev: 'Program Development: programs for the people we serve, community partners, research',
  opsto: 'Operations Toronto: the Toronto servings, volunteers and partners',
  marketing: 'Marketing: brand, social media, the website, photos and content, newsletters',
  fundraising: 'Fundraising: grants, donors, sponsors, fundraising events',
  finance: 'Finance: the books: invoices, bills, receipts, payments, reimbursements, bank and card notices, budgets',
  hr: 'Human Resources: hiring, applicants, onboarding, policies, people matters',
  board: 'Board and governance: board meetings, bylaws, the annual general meeting',
};
/* sensitive personal mail is never read by the model, for every owner: these subjects are left alone at once (health and care,
   support groups and fellowships, family law); each owner adds their own senders and words in Settings */
const NEVER_READ = /\b(alcoholics anonymous|narcotics anonymous|al-anon|sobriety|12[- ]step|twelve[- ]step|big book|home group|sponsee|therapy session|your therapist|counsell?ing session|psychiatr\w*|prescription|lab results|medical appointment|doctor'?s appointment|diagnosis|divorce|custody)\b/i;
const MAX_SORT = 25;
/* bulk and automated mail (a newsletter, a product update, a notification) never waits on a personal reply: the same signs the Hub
   inbox uses (a List-Unsubscribe header with a bulk sender, a mailing service or a bulk precedence) */
const BULK_LOCAL = /(^|[._-])(no-?reply|do-?not-?reply|newsletters?|mailer|notifications?|news|marketing|campaigns?|updates?|digest|hello|team)@/i;
const BULK_ESP = /mailchimp|mcsv\.net|sendgrid|constantcontact|hubspot|klaviyo|substack|campaign-archive|mailerlite|sendinblue|brevo|convertkit|list-manage|customer\.io|mailgun|postmarkapp|amazonses/i;
const BULK_DOMAIN = /^(updates?|news|newsletters?|mail|email|e|info|marketing|communications?|mailer|notifications?|engage|go)\./i;

type Label = { id: string; name: string; examples: string[] };
type Owner = { email: string; name: string | null; enabled: boolean; auto_sort: boolean; days_back: number; archive_labels: string[]; label_notes: Record<string, string>; skip_senders: string[]; skip_words: string[]; voice: string | null; labels: Label[]; labels_at: string | null; last_sort_at: string | null; last_result: string | null; last_error: string | null };

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}
async function log(entityType: string, entityId: string, field: string, value: string, by: string) {
  try { await svc.from('change_log').insert({ entity_type: entityType, entity_id: entityId, field, old_value: null, new_value: value.slice(0, 400), changed_by: by }); } catch (_) { /* audit only */ }
}
function clip(s: unknown, n: number): string { const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; }
function noDash(s: string): string { return String(s || '').replace(/\s*—\s*/g, ', ').replace(/–/g, '-'); }
function first(n: string | null | undefined): string { return String(n || '').trim().split(/\s+/)[0] || ''; }

/* ---- who is asking: their own mailbox (an alias counts as the address it belongs to) ---- */
async function canonical(email: string): Promise<string> {
  const e = email.toLowerCase();
  const { data } = await svc.from('wa_email_aliases').select('email, aliases');
  for (const r of (data || []) as Array<{ email: string; aliases: string[] }>) {
    if ((r.aliases || []).some(a => String(a).toLowerCase() === e)) return String(r.email).toLowerCase();
  }
  return e;
}
async function signedIn(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ') || auth === 'Bearer ' + ANON_KEY) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  if (!email) return null;
  return canonical(email);
}
async function ownerRow(email: string): Promise<Owner | null> {
  const { data } = await svc.from('mybox_owners').select('*').eq('email', email).maybeSingle();
  return (data as Owner | null) || null;
}

/* ---- Google: the service account acts as the owner ---- */
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
function utf8b64url(s: string): string { return b64url(new TextEncoder().encode(s)); }
function utf8b64(s: string): string { let o = ''; for (const b of new TextEncoder().encode(s)) o += String.fromCharCode(b); return btoa(o); }
function pemToDer(pem: string): Uint8Array {
  const body = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const raw = atob(body);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
const TOKENS: Record<string, { value: string; exp: number }> = {};
async function tokenFor(owner: string): Promise<string> {
  const scope = 'https://www.googleapis.com/auth/gmail.modify';
  const cached = TOKENS[owner];
  if (cached && Date.now() < cached.exp - 60000) return cached.value;
  const sa = JSON.parse(await getSecret('GOOGLE_SA_KEY'));
  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64url(enc.encode(JSON.stringify({ iss: sa.client_email, sub: owner, scope, aud: sa.token_uri, iat: now, exp: now + 3600 })));
  const signingInput = header + '.' + claims;
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key).buffer as ArrayBuffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(signingInput)));
  const res = await fetch(sa.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: signingInput + '.' + b64url(sig) }) });
  const body = await res.json();
  if (!body.access_token) throw new Error('Google did not let the Hub act for this mailbox: ' + JSON.stringify(body).slice(0, 200));
  TOKENS[owner] = { value: body.access_token, exp: Date.now() + (body.expires_in || 3600) * 1000 };
  return TOKENS[owner].value;
}
// deno-lint-ignore no-explicit-any
async function gmail(token: string, path: string): Promise<any> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me' + path, { headers: { Authorization: 'Bearer ' + token } });
  const b = await res.json().catch(() => null);
  if (!res.ok) throw new Error('gmail ' + path.split('?')[0].replace(/\/[A-Za-z0-9_-]{12,}/g, '/…') + ' ' + res.status + ' ' + JSON.stringify(b && b.error ? b.error.message : b).slice(0, 160));
  return b;
}
// deno-lint-ignore no-explicit-any
async function gmailWrite(token: string, method: string, path: string, payload: unknown): Promise<any> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me' + path, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const b = await res.json().catch(() => null);
  if (!res.ok) throw new Error('gmail ' + method + ' ' + path.split('?')[0].replace(/\/[A-Za-z0-9_-]{12,}/g, '/…') + ' ' + res.status + ' ' + JSON.stringify(b && b.error ? b.error.message : b).slice(0, 160));
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
type Att = { filename: string; mime: string; size: number };
// deno-lint-ignore no-explicit-any
function walk(part: any, out: { text: string[]; html: string[]; atts: Att[] }) {
  if (!part) return;
  const mime = String(part.mimeType || '');
  const filename = String(part.filename || '');
  if (filename && part.body && part.body.attachmentId) out.atts.push({ filename, mime, size: Number(part.body.size || 0) });
  else if (part.body && part.body.data) {
    const txt = new TextDecoder().decode(fromB64url(part.body.data));
    if (mime === 'text/plain') out.text.push(txt); else if (mime === 'text/html') out.html.push(txt);
  }
  (part.parts || []).forEach((p: unknown) => walk(p, out));
}
// deno-lint-ignore no-explicit-any
function bodyOf(msg: any): { text: string; atts: Att[] } {
  const parsed = { text: [] as string[], html: [] as string[], atts: [] as Att[] };
  walk(msg.payload, parsed);
  return { text: (parsed.text.join('\n').trim() || stripHtml(parsed.html.join('\n'))).slice(0, 60000), atts: parsed.atts };
}
/* the new part of a reply: cut the quoted history ("On ... wrote:", "-----Original Message-----", "> " lines) */
function freshPart(text: string): string {
  const lines = String(text || '').split('\n'), out: string[] = [];
  for (const l of lines) {
    if (/^\s*On .{6,140}wrote:\s*$/i.test(l) || /^\s*Le .{6,140}a écrit\s*:\s*$/i.test(l) || /^-{2,}\s*(Original Message|Forwarded message)\s*-{2,}/i.test(l) || /^\s*From: .+ Sent: /i.test(l)) break;
    if (/^\s*>/.test(l)) continue;
    out.push(l);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
function parseAddr(s: string): { email: string; name: string } {
  const m = String(s || '').match(/^(.*?)<([^>]+)>\s*$/);
  if (m) return { name: m[1].replace(/^"|"$/g, '').trim(), email: m[2].trim().toLowerCase() };
  return { name: '', email: String(s || '').trim().toLowerCase() };
}
function addrList(s: string): string[] {
  return String(s || '').split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(x => parseAddr(x.trim()).email).filter(e => /@/.test(e));
}

/* ---- the never-read list: personal mail stays unread by the model and unkept ---- */
function neverRead(owner: Owner, fromEmail: string, subject: string): boolean {
  const f = fromEmail.toLowerCase(), dom = f.split('@')[1] || '';
  if ((owner.skip_senders || []).some(x => { const k = String(x || '').trim().toLowerCase().replace(/^@/, ''); return !!k && (k === f || k === dom || (k.indexOf('@') < 0 && dom.endsWith('.' + k))); })) return true;
  const s = subject.toLowerCase();
  if ((owner.skip_words || []).some(w => { const k = String(w || '').trim().toLowerCase(); return !!k && new RegExp('(^|[^a-z0-9])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)').test(s); })) return true;
  return NEVER_READ.test(subject);
}

/* ---- the owner's labels, with a few recent subjects each (what the sorting learns from) ---- */
async function readLabels(owner: Owner, token: string): Promise<Label[]> {
  const list = await gmail(token, '/labels');
  // deno-lint-ignore no-explicit-any
  const user = ((list.labels || []) as any[]).filter(l => l.type === 'user' && !/^(Hub|\[Imap\]|Notes)(\/|$)/.test(String(l.name))).slice(0, 40);
  const out: Label[] = [];
  for (const l of user) {
    const examples: string[] = [];
    try {
      const ms = await gmail(token, '/messages?maxResults=4&labelIds=' + encodeURIComponent(l.id));
      // deno-lint-ignore no-explicit-any
      for (const it of ((ms.messages || []) as any[]).slice(0, 4)) {
        const m = await gmail(token, '/messages/' + it.id + '?format=metadata&metadataHeaders=Subject&metadataHeaders=From');
        const fr = parseAddr(hdr(m, 'From'));
        const subj = hdr(m, 'Subject');
        if (subj && !NEVER_READ.test(subj)) examples.push(clip(subj, 80) + ' (' + clip(fr.name || fr.email.split('@')[1] || '', 30) + ')');
      }
    } catch (_) { /* a label with no mail yet */ }
    out.push({ id: String(l.id), name: String(l.name), examples });
  }
  await svc.from('mybox_owners').update({ labels: out, labels_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('email', owner.email);
  owner.labels = out; owner.labels_at = new Date().toISOString();
  return out;
}

/* ---- the model router ---- */
// deno-lint-ignore no-explicit-any
async function jev(task: string, state: unknown, questions: unknown): Promise<any> {
  const res = await fetch(SUPABASE_URL + '/functions/v1/llm', { method: 'POST', headers: { Authorization: 'Bearer ' + SERVICE_KEY, 'x-wa-task': task, 'x-wa-caller': 'mybox', 'Content-Type': 'application/json' }, body: JSON.stringify({ state, questions }) });
  if (!res.ok) throw new Error('Jev ' + res.status + ' ' + (await res.text()).slice(0, 160));
  const out = await res.json();
  return (out && out.answers) || {};
}
// deno-lint-ignore no-explicit-any
async function tool(task: string, system: string, user: string, t: { name: string; description: string; input_schema: unknown }, maxTokens = 1400): Promise<any> {
  const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
    method: 'POST', headers: { Authorization: 'Bearer ' + SERVICE_KEY, 'x-wa-task': task, 'x-wa-caller': 'mybox', 'Content-Type': 'application/json' },
    body: JSON.stringify({ max_tokens: maxTokens, temperature: 0.4, system, messages: [{ role: 'user', content: user }], tools: [t], tool_choice: { type: 'tool', name: t.name } }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error('The model did not answer: ' + JSON.stringify(body && body.error ? body.error.message || body.error : body).slice(0, 200));
  // deno-lint-ignore no-explicit-any
  const tu = ((body && body.content) || []).find((c: any) => c.type === 'tool_use');
  if (!tu || !tu.input) throw new Error('The model gave no answer');
  return tu.input;
}

/* ---- sorting one message ---- */
type Sorted = { personal: number; label: Label | null; labelConf: number; team: string | null; teamConf: number; reply: number };
async function decide(owner: Owner, m: { from: string; to: string; cc: string; subject: string; date: string; text: string; atts: Att[] }): Promise<Sorted> {
  const labels = owner.labels || [];
  const keyOf: Record<string, Label> = {}, crit: Record<string, string> = {};
  labels.forEach((l, i) => {
    const k = 'L' + i; keyOf[k] = l;
    const note = (owner.label_notes || {})[l.id];
    crit[k] = l.name + (note ? ': ' + note : '') + (l.examples.length ? '. Recent mail in it: ' + l.examples.join('; ') : '');
  });
  crit.none = 'No folder clearly fits: leave it in the inbox without a label';
  const teams: Record<string, string> = { ...TEAM_WORK, none: 'No team: it is only for the owner (or nobody needs to act)' };
  const who = first(owner.name) || owner.email.split('@')[0];
  const state = {
    mailbox: owner.email + ' (' + who + ', at Welfare Avenue, a charity serving people in need in Montreal and Toronto)',
    email: { from: m.from, to: clip(m.to, 300), cc: clip(m.cc, 300), date: m.date, subject: m.subject, attachments: m.atts.map(a => a.filename).slice(0, 6), body_excerpt: clip(freshPart(m.text) || m.text, 2200) },
  };
  const questions: Record<string, unknown> = {
    personal: { type: 'noul', instructions: 'Is this personal mail rather than Welfare Avenue or professional mail: family or friends, health and care, faith, a support group or a fellowship (its meetings, a sponsor in it), personal money or personal accounts? Welfare Avenue event sponsors, donors and volunteers are not personal.' },
    team: { type: 'choice', instructions: 'Should a Welfare Avenue team handle this or hear about it? Pick the team, or none when it is only for ' + who + '.', criteria: teams },
    reply: { type: 'noul', instructions: 'Does this email need a personal reply from ' + who + ': a question or a request addressed to ' + who + ', an invitation, a person waiting on an answer from ' + who + '? No for newsletters, notifications, receipts, automated mail, FYIs, and threads where ' + who + ' is only copied or someone else is answering.' },
  };
  if (labels.length) questions.label = { type: 'choice', instructions: 'Which of ' + who + '\'s own folders (Gmail labels) does this email belong in? Pick none when no folder clearly fits.', criteria: crit };
  const a = await jev('mybox_sort', state, questions);
  const personal = typeof a.personal?.noul === 'number' ? a.personal.noul : 0;
  const lk = String(a.label?.choice || 'none'), lc = typeof a.label?.confidence === 'number' ? a.label.confidence : 0;
  const tk = String(a.team?.choice || 'none'), tc = typeof a.team?.confidence === 'number' ? a.team.confidence : 0;
  const reply = typeof a.reply?.noul === 'number' ? a.reply.noul : 0;
  return { personal, label: lk !== 'none' && keyOf[lk] ? keyOf[lk] : null, labelConf: lc, team: tk !== 'none' && TEAMS[tk] ? tk : null, teamConf: tc, reply };
}

async function sortOwner(owner: Owner, opts: { max?: number; dry?: boolean } = {}): Promise<Record<string, unknown>> {
  const token = await tokenFor(owner.email);
  if (!owner.labels || !owner.labels.length || !owner.labels_at || Date.now() - new Date(owner.labels_at).getTime() > 86400000) {
    try { await readLabels(owner, token); } catch (e) { console.error('labels', String(e).slice(0, 200)); }
  }
  const since = Math.floor((Date.now() - (owner.days_back || 3) * 86400000) / 1000);
  const list = await gmail(token, '/messages?maxResults=50&q=' + encodeURIComponent('in:inbox after:' + since + ' -in:chats'));
  // deno-lint-ignore no-explicit-any
  const ids: string[] = ((list.messages || []) as any[]).map(x => String(x.id));
  let known = new Set<string>();
  if (ids.length) { const { data } = await svc.from('mybox_mail').select('gmail_id').eq('owner', owner.email).in('gmail_id', ids); known = new Set((data || []).map(r => String(r.gmail_id))); }
  const fresh = ids.filter(id => !known.has(id)).reverse().slice(0, Math.min(MAX_SORT, opts.max || MAX_SORT));
  const tally = { seen: ids.length, fresh: fresh.length, labelled: 0, skipped: 0, team: 0, reply: 0, failed: 0 };
  const dryRows: Record<string, unknown>[] = [];
  for (const id of fresh) {
    try {
      const msg = await gmail(token, '/messages/' + id + '?format=full');
      const received = new Date(Number(msg.internalDate || Date.now())).toISOString();
      const from = parseAddr(hdr(msg, 'From')), subject = hdr(msg, 'Subject');
      if (from.email === owner.email) { if (!opts.dry) await svc.from('mybox_mail').insert({ owner: owner.email, gmail_id: id, thread_id: msg.threadId, received_at: received, from_email: from.email, from_name: from.name, subject: clip(subject, 300), snippet: clip(msg.snippet, 240), reply_p: 0 }); continue; }
      if (neverRead(owner, from.email, subject)) {
        tally.skipped++;
        if (opts.dry) dryRows.push({ skipped: 'list' });
        else await svc.from('mybox_mail').insert({ owner: owner.email, gmail_id: id, thread_id: msg.threadId, received_at: received, skipped: true, state: 'skipped' });
        continue;
      }
      const b = bodyOf(msg);
      const dom = from.email.split('@')[1] || '', unsub = hdr(msg, 'List-Unsubscribe');
      const bulk = !!unsub && !dom.endsWith('welfareavenue.com') && (BULK_LOCAL.test(from.email) || BULK_DOMAIN.test(dom) || BULK_ESP.test(unsub + ' ' + hdr(msg, 'List-Id') + ' ' + hdr(msg, 'Return-Path')) || /^(bulk|list)$/i.test(hdr(msg, 'Precedence')));
      const d = await decide(owner, { from: (from.name ? from.name + ' ' : '') + '<' + from.email + '>', to: hdr(msg, 'To'), cc: hdr(msg, 'Cc'), subject, date: received, text: b.text, atts: b.atts });
      if (bulk) d.reply = Math.min(d.reply, 0.2);   /* v1.2: a newsletter or an update never waits on a reply */
      if (d.personal >= 0.5) {
        tally.skipped++;
        if (opts.dry) dryRows.push({ skipped: 'personal', p: Math.round(d.personal * 100) / 100 });
        else await svc.from('mybox_mail').insert({ owner: owner.email, gmail_id: id, thread_id: msg.threadId, received_at: received, skipped: true, state: 'skipped' });
        continue;
      }
      const useLabel = d.label && d.labelConf >= 0.7 ? d.label : null;
      const archive = !!(useLabel && (owner.archive_labels || []).includes(useLabel.id));
      if (opts.dry) { dryRows.push({ label: useLabel ? useLabel.name : null, label_conf: Math.round(d.labelConf * 100) / 100, team: d.teamConf >= 0.6 && !dom.endsWith('welfareavenue.com') ? d.team : null, reply_p: Math.round(d.reply * 100) / 100, bulk, from_domain: from.email.split('@')[1] || '' }); continue; }
      let labelled = false;
      if (useLabel) {
        try { await gmailWrite(token, 'POST', '/messages/' + id + '/modify', { addLabelIds: [useLabel.id], removeLabelIds: archive ? ['INBOX'] : [] }); labelled = true; tally.labelled++; }
        catch (e) { console.error('label failed', String(e).slice(0, 160)); }
      }
      /* v1.3: mail from a colleague is already with the team: only outside mail is offered to a team */
      const team = d.team && d.teamConf >= 0.6 && !dom.endsWith('welfareavenue.com') ? d.team : null;
      if (team) tally.team++;
      if (d.reply >= 0.55) tally.reply++;
      await svc.from('mybox_mail').insert({
        owner: owner.email, gmail_id: id, thread_id: msg.threadId, received_at: received, from_email: from.email, from_name: from.name || null,
        subject: clip(subject, 300), snippet: clip(msg.snippet, 240),
        label_id: labelled ? useLabel!.id : null, label_name: labelled ? useLabel!.name : null, label_conf: d.label ? d.labelConf : null, labelled_at: labelled ? new Date().toISOString() : null, archived: labelled && archive,
        team, team_conf: d.team ? d.teamConf : null, reply_p: d.reply,
      });
    } catch (e) {
      tally.failed++;
      console.error('sort failed', String(e).slice(0, 200));
      if (!opts.dry) { try { await svc.from('mybox_mail').upsert({ owner: owner.email, gmail_id: id, state: 'error', error: String(e).slice(0, 300) }, { onConflict: 'owner,gmail_id' }); } catch (_) { /* fine */ } }
    }
  }
  /* a reply the owner already sent from Gmail closes the item */
  if (!opts.dry) { try { await tidyReplies(owner, token); } catch (e) { console.error('tidy', String(e).slice(0, 160)); } }
  const result = tally.fresh + ' new: ' + tally.labelled + ' labelled, ' + tally.reply + ' to reply, ' + tally.team + ' for a team, ' + tally.skipped + ' left alone' + (tally.failed ? ', ' + tally.failed + ' failed' : '');
  if (!opts.dry) {
    await svc.from('mybox_owners').update({ last_sort_at: new Date().toISOString(), last_result: result, last_error: null }).eq('email', owner.email);
    if (tally.fresh) await log('mybox', owner.email, 'sorted', result, 'mybox');
  }
  return { ok: true, ...tally, result, dry: opts.dry ? dryRows : undefined };
}
async function tidyReplies(owner: Owner, token: string) {
  const { data } = await svc.from('mybox_mail').select('id, thread_id, received_at').eq('owner', owner.email).eq('skipped', false).gte('reply_p', 0.55).is('reply_state', null).order('received_at', { ascending: false }).limit(15);
  for (const r of (data || []) as Array<{ id: number; thread_id: string | null; received_at: string }>) {
    if (!r.thread_id) continue;
    try {
      const th = await gmail(token, '/threads/' + r.thread_id + '?format=metadata&metadataHeaders=From');
      // deno-lint-ignore no-explicit-any
      const msgs = (th.messages || []) as any[];
      const mine = msgs.filter(m => parseAddr(hdr(m, 'From')).email === owner.email && Number(m.internalDate || 0) > new Date(r.received_at).getTime());
      if (mine.length) await svc.from('mybox_mail').update({ reply_state: 'done' }).eq('id', r.id);
    } catch (_) { /* the thread may be gone */ }
  }
}

/* ---- the thread, as the reply tool reads it ---- */
async function rowOf(owner: string, gmailId: string) {
  const { data } = await svc.from('mybox_mail').select('*').eq('owner', owner).eq('gmail_id', gmailId).maybeSingle();
  return data as Record<string, unknown> | null;
}
async function thread(owner: Owner, gmailId: string) {
  const token = await tokenFor(owner.email);
  const msg = await gmail(token, '/messages/' + gmailId + '?format=full');
  let msgs = [msg];
  if (msg.threadId) { try { const th = await gmail(token, '/threads/' + msg.threadId + '?format=full'); msgs = (th.messages || [msg]); } catch (_) { /* the message alone */ } }
  const idx = msgs.findIndex((m: { id: string }) => m.id === gmailId);
  const upto = idx >= 0 ? msgs.slice(0, idx + 1) : msgs;
  const later = idx >= 0 ? msgs.slice(idx + 1) : [];
  // deno-lint-ignore no-explicit-any
  const view = (m: any) => { const b = bodyOf(m); const f = parseAddr(hdr(m, 'From')); return { id: String(m.id), from: f.name ? f.name + ' <' + f.email + '>' : f.email, from_email: f.email, to: hdr(m, 'To'), cc: hdr(m, 'Cc'), date: new Date(Number(m.internalDate || 0)).toISOString(), subject: hdr(m, 'Subject'), text: clip(freshPart(b.text) || b.text, 6000), full: b.text.slice(0, 12000), atts: b.atts.map(a => a.filename).slice(0, 8), mine: f.email === owner.email }; };
  return { msg, main: view(msg), history: upto.slice(-6, -1).map(view), later: later.map(view), token };
}
function threadForModel(t: { main: { from: string; to: string; cc: string; date: string; subject: string; full: string; atts: string[] }; history: Array<{ from: string; date: string; text: string; mine: boolean }> }, ownerName: string): string {
  const hist = t.history.map(h => '--- ' + (h.mine ? ownerName + ' (the owner)' : h.from) + ', ' + h.date.slice(0, 10) + ':\n' + clip(h.text, 1500)).join('\n\n');
  return (hist ? 'EARLIER IN THE THREAD\n' + hist + '\n\n' : '') + 'THE EMAIL TO ANSWER\nFrom: ' + t.main.from + '\nTo: ' + t.main.to + (t.main.cc ? '\nCc: ' + t.main.cc : '') + '\nDate: ' + t.main.date + '\nSubject: ' + t.main.subject
    + (t.main.atts.length ? '\nAttachments: ' + t.main.atts.join(', ') : '') + '\n\n' + clip(freshPart(t.main.full) || t.main.full, 7000);
}

const Q_TOOL = { name: 'reply_questions', description: 'What to ask the owner before drafting their reply.', input_schema: { type: 'object', properties: {
  gist: { type: 'string', description: 'One line: what the sender wants from the owner, plainly (no em dashes)' },
  questions: { type: 'array', maxItems: 3, description: 'Only what you truly need to know to write the reply the owner would send: their decision, a fact only they know, how far to commit. Empty when nothing is needed.', items: { type: 'object', properties: {
    q: { type: 'string', description: 'The question, short and plain, addressed to the owner as "you"' },
    options: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'string' }, description: 'The likely answers, a few words each' },
  }, required: ['q', 'options'] } },
}, required: ['gist', 'questions'] } };
const READERS = ['board member', 'funder or donor', 'staff or volunteer', 'close collaborator', 'partner or community organisation', 'first contact', 'vendor or support desk', 'other'];
const REGISTERS = ['standard email', 'quick reply', 'closure reply', 'hard news'];
const D_TOOL = { name: 'reply_draft', description: 'The reply, ready for the owner to read, edit and send.', input_schema: { type: 'object', properties: {
  reader: { type: 'string', enum: READERS, description: 'Who is reading, in the writing guide\'s audience terms. Decide this first: it sets the calibration.' },
  register: { type: 'string', enum: REGISTERS, description: 'The register the email deserves, from the writing guide. Decide this before writing.' },
  body: { type: 'string', description: 'The email body only (no subject line), plain text, with the greeting and the sign-off. Anything the owner did not give you stays in [square brackets].' },
  notes: { type: 'array', items: { type: 'string' }, maxItems: 3, description: 'Anything the owner should check before sending, one short line each (a [bracket] to fill, a date to confirm)' },
}, required: ['reader', 'register', 'body', 'notes'] } };
const R_TOOL = { name: 'reply_revised', description: 'The same reply with the listed phrases written out.', input_schema: { type: 'object', properties: {
  body: { type: 'string', description: 'The revised email body, plain text, greeting to sign-off' },
}, required: ['body'] } };
/* wa-writing's and steel-voice's banned phrases, checked after the model writes (one revision if any is left) */
const BANNED: Array<[RegExp, string]> = [
  [/hope (this|the) (e-?mail |message |note )?finds you/i, 'a stock opener ("Hope this finds you well")'],
  [/\bhope you('| a)re (doing )?(well|good)/i, 'a stock opener ("I hope you\'re doing well")'],
  [/let me know if you have any (other |further )?questions/i, 'a stock closer ("Let me know if you have any questions")'],
  [/(do not|don'?t) hesitate to/i, 'a stock closer ("Don\'t hesitate to ...")'],
  [/\b(circle back|touch base|synerg\w*|leverag\w*|utili[sz]\w*)\b/i, 'corporate filler (circle back, touch base, synergy, leverage, utilise)'],
  [/\bI just wanted to\b/i, 'a hedge ("I just wanted to")'],
  [/(in these (challenging|difficult|uncertain) times|making a difference together)/i, 'charity boilerplate'],
  [/\bwhilst\b|it is for this reason that/i, 'retired stiff formality ("whilst", "it is for this reason that")'],
  [/[A-Za-z] & [A-Za-z]/, '"&" in prose (write "and")'],
];
function lint(body: string): string[] { return BANNED.filter(([re]) => re.test(body)).map(([, why]) => why); }
function frameworkOf(voice: string | null): string {
  const m = /^\s*FRAMEWORK:\s*([^\n(]+)/i.exec(String(voice || ''));
  return m ? m[1].trim().replace(/[.,;:]+$/, '') : (voice ? 'your writing guide' : 'the house style');
}
/* the Hub's verified facts (wave193's fact base): what a reply may state as fact besides the owner and the thread */
let FACTS: string | null = null;
async function waFacts(): Promise<string> {
  if (FACTS != null) return FACTS;
  try {
    const { data } = await svc.from('fund_facts').select('category, title, body').eq('status', 'verified').neq('category', 'budget').order('sort', { ascending: true, nullsFirst: false }).limit(60);
    FACTS = ((data || []) as Array<{ category: string; title: string; body: string }>).map(f => '- ' + f.title + ': ' + clip(f.body, 600)).join('\n');
  } catch (_) { FACTS = ''; }
  return FACTS;
}
const A_TOOL = { name: 'team_ask', description: 'What the team should do about this email.', input_schema: { type: 'object', properties: {
  ask: { type: 'string', description: 'One line, at most 160 characters, addressed to the team: what they should do about it (no em dashes)' },
  person: { type: ['string', 'null'], description: 'The email of the one person on the team it is for, from the list, or null when it is for the team' },
}, required: ['ask', 'person'] } };

async function questionsFor(owner: Owner, gmailId: string) {
  const t = await thread(owner, gmailId);
  const who = first(owner.name) || 'the owner';
  const sys = 'You help ' + who + ' reply to email at Welfare Avenue, a charity serving people in need in Montreal and Toronto. Before a reply is drafted, you ask ' + who + ' only what you truly need to know to write the reply ' + who + ' would send: a decision (yes or no, which option, when), a fact only ' + who + ' knows, or how far to commit. Never ask what the email already answers, never ask about tone or sign-off, and ask nothing at all for a simple reply. Offer the likely answers so ' + who + ' can tap one. Never use em dashes.';
  const out = await tool('mybox_reply', sys, threadForModel(t, who), Q_TOOL, 900);
  const qs = Array.isArray(out.questions) ? out.questions.slice(0, 3).map((q: { q: unknown; options: unknown }) => ({ q: noDash(clip(q.q, 200)), options: (Array.isArray(q.options) ? q.options : []).slice(0, 4).map((o: unknown) => noDash(clip(o, 80))) })) : [];
  return { gist: noDash(clip(out.gist, 240)), questions: qs, main: t.main, history: t.history, later: t.later };
}
async function draftFor(owner: Owner, gmailId: string, answers: Array<{ q: string; a: string }>, note: string) {
  const t = await thread(owner, gmailId);
  const who = first(owner.name) || 'the owner';
  const facts = await waFacts();
  const fw = frameworkOf(owner.voice);
  const sys = 'THE WRITING GUIDE (' + fw + '): follow it as the framework for this email, every rule and calibration in it.\n\n'
    + (owner.voice || ('You write as ' + who + '. Clear, warm and direct. Never use em dashes. Never invent facts: anything not given goes in [square brackets].'))
    + (facts ? '\n\nWELFARE AVENUE FACTS (the Hub\'s verified fact base: the only standing facts and figures you may state besides what ' + who + ' says and what the thread says; anything else goes in [square brackets])\n' + facts : '')
    + '\n\nYOUR JOB NOW\nFirst decide who is reading (the guide\'s audiences) and the register the email deserves; then write ' + who + '\'s reply to the email below, as ' + who + ' would send it, calibrated for that reader. The answers to the questions are the substance; do not add commitments, dates, amounts or names ' + who + ' did not give (put them in [square brackets]). Reply to the sender in their language. Keep it as short as the email deserves. Run the guide\'s final check before you answer.';
  const user = threadForModel(t, who) + '\n\nWHAT ' + who.toUpperCase() + ' SAYS\n' + (answers.length ? answers.map(x => '- ' + x.q + ' ' + x.a).join('\n') : '(no questions were needed)') + (note ? '\nAnything else: ' + note : '');
  const out = await tool('mybox_reply', sys, user, D_TOOL, 1800);
  let body = noDash(String(out.body || '').trim());
  let revised = false;
  const left = lint(body);
  if (left.length && body) {
    try {
      const r = await tool('mybox_reply', sys, 'Here is the reply you wrote:\n\n' + body + '\n\nThe writing guide bans what is still in it: ' + left.join('; ') + '. Write those parts out in ' + who + '\'s own words. Change nothing else: same substance, same [brackets], same greeting and sign-off.', R_TOOL, 1600);
      const b2 = noDash(String(r.body || '').trim());
      if (b2 && lint(b2).length < left.length) { body = b2; revised = true; }
    } catch (_) { /* keep the first draft; the notes say what to fix */ }
  }
  const still = lint(body);
  const brackets = Array.from(new Set((body.match(/\[[^\]\n]{1,80}\]/g) || []))).slice(0, 8);
  const notes = (Array.isArray(out.notes) ? out.notes : []).slice(0, 3).map((n: unknown) => noDash(clip(n, 160)));
  if (still.length) notes.push('The guide bans ' + still.join('; ') + ': worth a rewrite before sending.');
  const reader = READERS.includes(String(out.reader)) ? String(out.reader) : 'other';
  const register = REGISTERS.includes(String(out.register)) ? String(out.register) : 'standard email';
  return { body, notes, brackets, framework: { name: fw, reader, register, revised } };
}

/* ---- a Gmail draft in the thread (the owner sends it) ---- */
function encSubject(s: string): string { return /^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + utf8b64(s) + '?='; }
async function saveDraft(owner: Owner, gmailId: string, bodyText: string, replyAll: boolean) {
  const token = await tokenFor(owner.email);
  const msg = await gmail(token, '/messages/' + gmailId + '?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Message-ID&metadataHeaders=References&metadataHeaders=Reply-To');
  const replyTo = hdr(msg, 'Reply-To') || hdr(msg, 'From');
  const to = addrList(replyTo).filter(e => e !== owner.email);
  if (!to.length) throw new Error('There is nobody to reply to on this email');
  const cc = replyAll ? Array.from(new Set(addrList(hdr(msg, 'To') + ',' + hdr(msg, 'Cc')).filter(e => e !== owner.email && !to.includes(e)))) : [];
  const subj0 = hdr(msg, 'Subject') || '';
  const subject = /^(re|réf|tr|fwd?)\s*:/i.test(subj0) ? subj0 : 'Re: ' + subj0;
  const mid = hdr(msg, 'Message-ID'), refs = hdr(msg, 'References');
  const lines = ['To: ' + to.join(', ')];
  if (cc.length) lines.push('Cc: ' + cc.join(', '));
  lines.push('Subject: ' + encSubject(subject));
  if (mid) { lines.push('In-Reply-To: ' + mid); lines.push('References: ' + (refs ? refs + ' ' : '') + mid); }
  lines.push('MIME-Version: 1.0', 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', utf8b64(noDash(bodyText).replace(/\r?\n/g, '\r\n')).replace(/(.{76})/g, '$1\r\n'));
  const raw = utf8b64url(lines.join('\r\n'));
  /* the email's earlier draft from the Hub, if it is still a draft in Gmail, is updated (no second draft) */
  const row = await rowOf(owner.email, gmailId);
  let prev: string | null = row && row.draft_id ? String(row.draft_id) : null;
  if (prev) { try { const g = await gmail(token, '/drafts/' + encodeURIComponent(prev) + '?format=minimal'); if (!g || !g.message || g.message.threadId !== msg.threadId) prev = null; } catch (_) { prev = null; } }
  const d = prev
    ? await gmailWrite(token, 'PUT', '/drafts/' + encodeURIComponent(prev), { id: prev, message: { raw, threadId: msg.threadId } })
    : await gmailWrite(token, 'POST', '/drafts', { message: { raw, threadId: msg.threadId } });
  const draftId = String((d && d.id) || '');
  if (!draftId) throw new Error('Gmail did not return a draft');
  /* read it back: it must be a draft, in the email's thread, before the Hub says it is saved */
  let check: { message?: { threadId?: string; labelIds?: string[] } } | null = null;
  try { check = await gmail(token, '/drafts/' + encodeURIComponent(draftId) + '?format=minimal'); } catch (e) { throw new Error('Gmail did not keep the draft (' + String((e as Error).message || e).slice(0, 120) + ')'); }
  const cm = (check && check.message) || {};
  if (cm.threadId !== msg.threadId || !(cm.labelIds || []).includes('DRAFT')) throw new Error('Gmail did not keep the draft in this email\'s thread');
  const now = new Date().toISOString();
  await svc.from('mybox_mail').update({ reply_state: 'drafted', draft_id: draftId, drafted_at: now }).eq('owner', owner.email).eq('gmail_id', gmailId);
  await log('mybox_mail', gmailId, prev ? 'draft updated' : 'draft saved', 'draft ' + draftId + ' in thread ' + msg.threadId + ', checked in Gmail', owner.name || owner.email);
  return { draft_id: draftId, thread_id: msg.threadId, to, cc, subject, updated: !!prev, checked_at: now, url: draftLink(owner.email, msg.threadId, draftId), drafts_url: draftsLink(owner.email) };
}
/* Gmail's own link to open a draft (what Google returns as a draft's viewUrl): the owner's account by authuser, the thread id in
   decimal, the draft id; a browser signed in to several Google accounts opens the right one */
function draftLink(email: string, threadId: string, draftId: string): string {
  let dec = '';
  try { dec = BigInt('0x' + threadId).toString(); } catch (_) { return draftsLink(email); }
  return 'https://mail.google.com/mail/?authuser=' + encodeURIComponent(email).replace('%40', '@') + '#all?compose=thread-f:' + dec + '%2Bmsg-a:' + encodeURIComponent(draftId);
}
function draftsLink(email: string): string { return 'https://mail.google.com/mail/?authuser=' + encodeURIComponent(email).replace('%40', '@') + '#drafts'; }

/* ---- sending an email to a team (their Hub inbox; team-inbox tells them) ---- */
async function teamPeople(team: string): Promise<Array<{ name: string; email: string; role: string | null }>> {
  const { data } = await svc.from('team_members').select('name, email, role, department').eq('active', true).eq('department', team);
  return ((data || []) as Array<{ name: string; email: string | null; role: string | null }>).filter(p => p.email).map(p => ({ name: p.name, email: String(p.email).toLowerCase(), role: p.role }));
}
async function suggestAsk(owner: Owner, gmailId: string, team: string) {
  const t = await thread(owner, gmailId);
  const people = await teamPeople(team);
  const who = first(owner.name) || 'The owner';
  const sys = who + ' is sending an email they received to the ' + TEAMS[team] + ' team at Welfare Avenue, with one line saying what they should do about it. Write that line as ' + who + ' would, plainly and kindly, addressed to the team (for example "Can you reply to Maria about volunteering on Oct 12? She asked whether students can join."). Pick the one person on the team it is for when the email clearly belongs to one role, else null. Never use em dashes.';
  const user = 'THE TEAM: ' + TEAMS[team] + ' (' + TEAM_WORK[team] + ')\nPEOPLE ON IT:\n' + (people.map(p => p.name + ' <' + p.email + '> ' + (p.role || '')).join('\n') || '(none listed)') + '\n\n' + threadForModel(t, who);
  const out = await tool('mybox_reply', sys, user, A_TOOL, 400);
  const person = out.person && people.some(p => p.email === String(out.person).toLowerCase()) ? String(out.person).toLowerCase() : null;
  return { ask: noDash(clip(out.ask, 200)), person, people };
}
async function toTeam(owner: Owner, gmailId: string, team: string, ask: string, personEmail: string | null, dry = false) {
  if (!TEAMS[team]) throw new Error('Pick a team');
  const t = await thread(owner, gmailId);
  const people = await teamPeople(team);
  const person = personEmail ? people.find(p => p.email === personEmail.toLowerCase()) || null : null;
  const main = t.main, b = bodyOf(t.msg);
  const links = Array.from(new Set((b.text.match(/https?:\/\/[^\s<>"')\]]+/g) || []).map(l => l.replace(/[.,;:]+$/, '')))).slice(0, 30);
  const fwd = { gmail_id: 'person:' + owner.email.split('@')[0] + ':' + gmailId, thread_id: null, internal_date: main.date, from_email: main.from_email, from_name: parseAddr(main.from).name || null,
    to_list: clip(main.to, 1000), cc_list: clip(main.cc, 1000), subject: clip(main.subject, 500), snippet: clip(t.msg.snippet, 300), body_text: b.text, attachments: b.atts, links,
    kind: 'update', department: team, title: clip(main.subject || 'An email from ' + (owner.name || owner.email), 90), summary: clip(ask, 600), confidence: 1,
    reason: 'sent to the team by ' + (owner.name || owner.email) + ' from their inbox', status: 'new', mailbox: 'person', ask: clip(ask, 300),
    forwarded_by: owner.name || owner.email, assignee: person ? person.name : null, assignee_email: person ? person.email : null };
  if (dry) return { dry: true, row: { ...fwd, body_text: clip(fwd.body_text, 200), attachments: fwd.attachments.map(a => a.filename) } };
  const { data: prev } = await svc.from('hub_mail').select('id, status').eq('gmail_id', fwd.gmail_id).maybeSingle();
  if (prev && prev.status === 'filed') throw new Error('It is already in that team\'s inbox');
  const ins = prev ? await svc.from('hub_mail').update(fwd).eq('id', prev.id).select('id').single() : await svc.from('hub_mail').insert(fwd).select('id').single();
  if (ins.error) throw new Error('The Hub inbox did not take it: ' + ins.error.message);
  const id = ins.data.id as number;
  await svc.from('hub_mail').update({ status: 'filed', filed: { type: 'forward', by: owner.name || owner.email, from: 'inbox assistant' } }).eq('id', id);
  await svc.from('mybox_mail').update({ team, team_state: 'sent', sent_mail_id: id, sent_at: new Date().toISOString() }).eq('owner', owner.email).eq('gmail_id', gmailId);
  await log('hub_mail', String(id), 'sent to the team', (owner.name || owner.email) + ' sent it to ' + TEAMS[team] + (person ? ' for ' + person.name : '') + ': ' + ask, owner.name || owner.email);
  return { mail_id: id, team, person: person ? person.name : null };
}

/* ---- the entry ---- */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action || 'status');
  let secretOk = false;
  try { const g = req.headers.get('x-wa-secret'); if (g && g === (await getSecret('WA_TRIGGER_SECRET'))) secretOk = true; } catch (_) { /* no */ }
  try {
    if (secretOk) {
      /* the schedule: every owner who turned sorting on; a dry sort returns decisions without any mail */
      if (action !== 'sort') return json({ error: 'The schedule can only sort.' }, 403);
      const q0 = svc.from('mybox_owners').select('*').eq('enabled', true);
      const { data: owners } = body.owner ? await q0.eq('email', String(body.owner).toLowerCase()) : await q0.eq('auto_sort', true);
      const work = (async () => {
        const out: Record<string, unknown> = {};
        for (const o of (owners || []) as Owner[]) {
          try { out[o.email] = await sortOwner(o, { max: Number(body.max || MAX_SORT), dry: body.dry_run === true }); }
          catch (e) { out[o.email] = { error: String((e as Error).message || e).slice(0, 300) }; if (body.dry_run !== true) await svc.from('mybox_owners').update({ last_sort_at: new Date().toISOString(), last_error: String((e as Error).message || e).slice(0, 300) }).eq('email', o.email); }
        }
        return out;
      })();
      if (body.wait === true || body.dry_run === true) return json({ ok: true, owners: await work });
      // @ts-ignore EdgeRuntime is provided by the Supabase edge runtime
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) { EdgeRuntime.waitUntil(work); return json({ accepted: true }, 202); }
      return json({ ok: true, owners: await work });
    }
    const me = await signedIn(req);
    if (!me) return json({ error: 'Sign in to the Hub first.' }, 401);
    const owner = await ownerRow(me);
    if (!owner || !owner.enabled) return json({ error: 'The inbox assistant is not on for your mailbox.', off: true }, 403);
    const gid = String(body.gmail_id || '');
    const needRow = async () => { const r = await rowOf(owner.email, gid); if (!r || r.skipped) throw Object.assign(new Error('That email is not in your assistant'), { status: 404 }); return r; };

    if (action === 'status') {
      const { count: toReply } = await svc.from('mybox_mail').select('id', { count: 'exact', head: true }).eq('owner', owner.email).eq('skipped', false).gte('reply_p', 0.55).is('reply_state', null);
      const { count: toTeam } = await svc.from('mybox_mail').select('id', { count: 'exact', head: true }).eq('owner', owner.email).not('team', 'is', null).is('team_state', null);
      return json({ ok: true, owner: { ...owner, voice: undefined, voice_framework: frameworkOf(owner.voice), voice_len: String(owner.voice || '').length }, counts: { to_reply: toReply || 0, to_team: toTeam || 0 } });
    }
    if (action === 'voice') {
      /* the owner's own writing guide (wave201): only they read it, through this action */
      return json({ ok: true, voice: owner.voice || '', framework: frameworkOf(owner.voice) });
    }
    if (action === 'labels') {
      const token = await tokenFor(owner.email);
      const labels = body.refresh === true || !owner.labels.length ? await readLabels(owner, token) : owner.labels;
      return json({ ok: true, labels, labels_at: owner.labels_at });
    }
    if (action === 'settings') {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof body.auto_sort === 'boolean') patch.auto_sort = body.auto_sort;
      if (body.days_back != null) patch.days_back = Math.max(1, Math.min(14, Number(body.days_back) || 3));
      const ids = new Set((owner.labels || []).map(l => l.id));
      if (Array.isArray(body.archive_labels)) patch.archive_labels = (body.archive_labels as unknown[]).map(String).filter(x => ids.has(x)).slice(0, 40);
      if (body.label_notes && typeof body.label_notes === 'object') { const n: Record<string, string> = {}; Object.entries(body.label_notes as Record<string, unknown>).forEach(([k, v]) => { if (ids.has(k) && String(v || '').trim()) n[k] = clip(v, 200); }); patch.label_notes = n; }
      const cleanList = (v: unknown) => (Array.isArray(v) ? v : String(v || '').split(/[\n,;]+/)).map(x => String(x).trim().toLowerCase()).filter(x => x && x.length <= 120).slice(0, 80);
      if (body.skip_senders !== undefined) patch.skip_senders = cleanList(body.skip_senders);
      if (body.skip_words !== undefined) patch.skip_words = cleanList(body.skip_words);
      if (typeof body.voice === 'string') { const v = String(body.voice).replace(/\r\n/g, '\n').trim(); if (v.length > 20000) return json({ error: 'The guide is too long (20,000 characters at most)' }, 400); patch.voice = v || null; }
      const { error } = await svc.from('mybox_owners').update(patch).eq('email', owner.email);
      if (error) throw new Error(error.message);
      if (patch.auto_sort !== undefined) await log('mybox', owner.email, 'auto sort', patch.auto_sort ? 'on' : 'off', owner.name || owner.email);
      if (patch.voice !== undefined) await log('mybox', owner.email, 'writing guide', patch.voice ? 'updated (' + String(patch.voice).length + ' characters, ' + frameworkOf(patch.voice as string) + ')' : 'cleared', owner.name || owner.email);
      return json({ ok: true });
    }
    if (action === 'sort' || action === 'retry') {
      if (action === 'retry') await svc.from('mybox_mail').delete().eq('owner', owner.email).eq('state', 'error');
      const job = sortOwner(owner, { max: MAX_SORT }).catch(async (e) => { await svc.from('mybox_owners').update({ last_sort_at: new Date().toISOString(), last_error: String((e as Error).message || e).slice(0, 300) }).eq('email', owner.email); return { error: String(e) }; });
      if (body.wait === true) return json(await job);
      // @ts-ignore EdgeRuntime is provided by the Supabase edge runtime
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) { EdgeRuntime.waitUntil(job); return json({ accepted: true, started: new Date().toISOString() }, 202); }
      return json(await job);
    }
    if (action === 'open') {
      await needRow();
      const t = await thread(owner, gid);
      return json({ ok: true, main: { ...t.main, full: undefined }, history: t.history.map(h => ({ ...h, full: undefined })), later: t.later.map(h => ({ ...h, full: undefined })) });
    }
    if (action === 'questions') { await needRow(); const q = await questionsFor(owner, gid); return json({ ok: true, gist: q.gist, questions: q.questions, answered: q.later.some(l => l.mine) }); }
    if (action === 'draft') {
      await needRow();
      const answers = (Array.isArray(body.answers) ? body.answers : []).slice(0, 5).map((x: { q?: unknown; a?: unknown }) => ({ q: clip(x && x.q, 200), a: clip(x && x.a, 600) })).filter((x: { a: string }) => x.a);
      return json({ ok: true, ...(await draftFor(owner, gid, answers, clip(body.note, 800))) });
    }
    if (action === 'save_draft') {
      await needRow();
      const text = String(body.body || '').trim();
      if (!text) return json({ error: 'The reply is empty' }, 400);
      if (text.length > 20000) return json({ error: 'The reply is too long' }, 400);
      return json({ ok: true, ...(await saveDraft(owner, gid, text, body.reply_all === true)) });
    }
    if (action === 'suggest_ask') { await needRow(); const team = String(body.team || ''); if (!TEAMS[team]) return json({ error: 'Pick a team' }, 400); return json({ ok: true, ...(await suggestAsk(owner, gid, team)) }); }
    if (action === 'to_team') {
      await needRow();
      const ask = String(body.ask || '').trim();
      if (!ask) return json({ error: 'Say in one line what the team should do' }, 400);
      return json({ ok: true, ...(await toTeam(owner, gid, String(body.team || ''), ask, body.person ? String(body.person) : null, body.dry_run === true)) });
    }
    if (action === 'done') {
      await needRow();
      const what = String(body.what || '');
      const patch: Record<string, unknown> = what === 'reply_done' ? { reply_state: 'done' } : what === 'reply_dismiss' ? { reply_state: 'dismissed' } : what === 'reply_reopen' ? { reply_state: null } : what === 'team_dismiss' ? { team_state: 'dismissed' } : what === 'team_reopen' ? { team_state: null } : {};
      if (!Object.keys(patch).length) return json({ error: 'unknown' }, 400);
      await svc.from('mybox_mail').update(patch).eq('owner', owner.email).eq('gmail_id', gid);
      return json({ ok: true });
    }
    if (action === 'unlabel') {
      const r = await needRow();
      if (!r.label_id) return json({ ok: true });
      const token = await tokenFor(owner.email);
      await gmailWrite(token, 'POST', '/messages/' + gid + '/modify', { addLabelIds: r.archived ? ['INBOX'] : [], removeLabelIds: [String(r.label_id)] });
      await svc.from('mybox_mail').update({ label_id: null, label_name: null, labelled_at: null, archived: false }).eq('owner', owner.email).eq('gmail_id', gid);
      return json({ ok: true });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e).slice(0, 300) }, Number((e as { status?: number }).status) || 500);
  }
});
