// wave289, 07/11/26: the shared mail rules (design "03 email history", 5.1 and 5.3).
// One source of truth for how the Hub reads mail: the personal never-read list (NEVER_READ, neverRead), mybox's bulk combination,
// Google's notices, calendar, security and info@ tests, addressedToMailbox (B2), freshPart, address parsing, subject cleaning, the
// rule-only personal filter (probablyPersonal, M2), the delivery-report parser (M6), the checks every model answer passes before it is
// staged (validateRead, validateOrg, M10) and the network safety check for homepage fetches (safeHost, M10).
// Used by mail-history (wave289). mybox and mail-pull keep their own copies until their next reviewed change moves them here (R15);
// mail_rules.test.ts pins the behaviour with invented mail. Pure functions only: no network, no database, no Deno or Node globals.
// Deploy copies this file beside each function's index.ts as mail_rules.ts (build/fn.py refuses and says so; use the Supabase connector).

/* ---- the never-read list (mybox v1.x): sensitive personal mail is never read by a model, for every owner ---- */
export const NEVER_READ = /\b(alcoholics anonymous|narcotics anonymous|al-anon|sobriety|12[- ]step|twelve[- ]step|big book|home group|sponsee|therapy session|your therapist|counsell?ing session|psychiatr\w*|prescription|lab results|medical appointment|doctor'?s appointment|diagnosis|divorce|custody)\b/i;

export type OwnerRules = { skip_senders?: string[] | null; skip_words?: string[] | null };

function escapeRe(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/** mybox's rule: the owner's own senders and words, then NEVER_READ on the subject. */
export function neverRead(owner: OwnerRules | null, fromEmail: string, subject: string): boolean {
  const f = String(fromEmail || '').toLowerCase(), dom = f.split('@')[1] || '';
  const o = owner || {};
  if ((o.skip_senders || []).some(x => { const k = String(x || '').trim().toLowerCase().replace(/^@/, ''); return !!k && (k === f || k === dom || (k.indexOf('@') < 0 && dom.endsWith('.' + k))); })) return true;
  const s = String(subject || '').toLowerCase();
  if ((o.skip_words || []).some(w => { const k = String(w || '').trim().toLowerCase(); return !!k && new RegExp('(^|[^a-z0-9])' + escapeRe(k) + '([^a-z0-9]|$)').test(s); })) return true;
  return NEVER_READ.test(String(subject || ''));
}

/* ---- bulk and automated mail: mybox's combination (a List-Unsubscribe header together with a bulk sign) ---- */
export const BULK_LOCAL = /(^|[._-])(no-?reply|do-?not-?reply|newsletters?|mailer|notifications?|news|marketing|campaigns?|updates?|digest|hello|team)@/i;
export const BULK_ESP = /mailchimp|mcsv\.net|sendgrid|constantcontact|hubspot|klaviyo|substack|campaign-archive|mailerlite|sendinblue|brevo|convertkit|list-manage|customer\.io|mailgun|postmarkapp|amazonses/i;
export const BULK_DOMAIN = /^(updates?|news|newsletters?|mail|email|e|info|marketing|communications?|mailer|notifications?|engage|go)\./i;
export const NOISE_SENDERS = /(no-?reply@accounts\.google\.com|mail-noreply@google\.com|chat-noreply@google\.com|calendar-notification@google\.com|drive-shares-noreply@google\.com|drive-shares-dm-noreply@google\.com|comments-noreply@docs\.google\.com|noreply@google\.com|workspace-noreply@google\.com|googleworkspace-noreply@google\.com|forms-receipts-noreply@google\.com)/i;

/** A header reader: the value of a header by name (case-insensitive), or ''. */
export type Hdr = (name: string) => string;

/** The headers of a Gmail message resource as a reader. */
// deno-lint-ignore no-explicit-any
export function headerReader(msg: any): Hdr {
  const hs = (msg && msg.payload && msg.payload.headers) || [];
  return (name: string) => {
    // deno-lint-ignore no-explicit-any
    const h = hs.find((x: any) => String(x.name).toLowerCase() === name.toLowerCase());
    return h ? String(h.value) : '';
  };
}

/** mybox's bulk rule: List-Unsubscribe plus a bulk local part, a bulk domain, a mailing service or Precedence bulk/list.
 *  Precedence and Auto-Submitted never decide alone. Mail from welfareavenue.com is never bulk. */
export function isBulk(h: Hdr, fromEmail: string): boolean {
  const from = String(fromEmail || '').toLowerCase(), dom = from.split('@')[1] || '';
  const unsub = h('List-Unsubscribe');
  if (!unsub || dom === 'welfareavenue.com' || dom.endsWith('.welfareavenue.com')) return false;   // eh-289 M7: whole labels only
  return BULK_LOCAL.test(from) || BULK_DOMAIN.test(dom) || BULK_ESP.test(unsub + ' ' + h('List-Id') + ' ' + h('Return-Path')) || /^(bulk|list)$/i.test(h('Precedence').trim());
}
/** eh-289 C1: mail through Welfare Avenue's own Google Group (info@). Google Groups add List-Unsubscribe and Precedence: list to every post,
 *  so mybox's bulk rule would drop a person writing to info@. A post is WA's group when its List-Id is <info.welfareavenue.com> or info@ is in
 *  the addressing headers. */
export function isWaGroup(h: Hdr): boolean {
  return isWaGroupList(h) || toInfo(h);
}
/** The group's own List-Id (<info.welfareavenue.com>), without the addressing test (eh-292 minor: the " via " swap trusts only this). */
export function isWaGroupList(h: Hdr): boolean {
  return /(^|[<\s])info\.welfareavenue\.com>?\s*$/i.test(h('List-Id').trim());
}
/** eh-292 fix 3: the original sender of a group post looks automated: a bulk domain (news., updates., ...) or a no-reply, newsletter or
 *  notifications local part. hello@, info@ and contact@ are people's and small organisations' addresses and never count here. */
export const GROUP_BULK_LOCAL = /(^|[._-])(no-?reply|do-?not-?reply|newsletters?|notifications?)@/i;
export function groupSenderBulk(fromEmail: string): boolean {
  const from = String(fromEmail || '').toLowerCase(), dom = from.split('@')[1] || '';
  if (!dom || dom === 'welfareavenue.com' || dom.endsWith('.welfareavenue.com')) return false;
  if (/^(hello|info|contact)@/.test(from)) return false;
  return GROUP_BULK_LOCAL.test(from) || BULK_DOMAIN.test(dom);
}
/** For WA's group only (mail-pull's rule for hub@): bulk when Precedence is exactly bulk, or a mailing service shows in the unsubscribe or return
 *  path (the group's own groups.google.com unsubscribe link does not count). Precedence: list, a bulk-looking local part (hello@) and the group's
 *  List-Unsubscribe never decide it. */
export function groupBulk(h: Hdr, fromEmail = ''): boolean {
  const unsub = h('List-Unsubscribe').replace(/<[^>]*google(groups)?\.com[^>]*>/gi, '').replace(/<[^>]*googlegroups[^>]*>/gi, '');
  return /^bulk$/i.test(h('Precedence').trim()) || BULK_ESP.test(unsub + ' ' + h('Return-Path')) || groupSenderBulk(fromEmail);   // eh-292 fix 3: the original sender too
}
/** Google's own notices (sign-in, Drive shares, Chat, Calendar). */
export function isGoogleNotice(fromEmail: string): boolean { return NOISE_SENDERS.test(String(fromEmail || '')); }

/* ---- calendar, security and noise (mail-pull v10) ---- */
export const CALENDAR_SUBJECT = /^(invitation|invitation with note|updated invitation|updated invitation with note|accepted|declined|tentatively accepted|canceled event|cancelled event|canceled event with note|cancelled event with note|new event|reminder|invitation mise à jour|accepté|refusé|événement annulé):/i;
export function isCalendar(subject: string, contentType = ''): boolean {
  return CALENDAR_SUBJECT.test(String(subject || '').trim()) || /text\/calendar|application\/ics/i.test(String(contentType || ''));
}
export const SECURITY = /\b(verification code|confirmation code|security code|login code|log[- ]in code|sign[- ]in code|one[- ]time (code|password|passcode|pin)|2-step verification|two[- ]factor|2fa|security alert|new sign[- ]in|sign[- ]in attempt|password (has been |was )?(reset|changed)|reset your password|password reset|verify your (email|account|identity|device|login)|your code is)\b/i;
export const SECURITY_BODY = /\b(your (verification|security|confirmation|one[- ]time|login|log[- ]in|sign[- ]in) code is|use (this|the following) code to (sign|log|verify|confirm|reset))\b/i;
export function isSecurity(subject: string, body = ''): boolean { return SECURITY.test(String(subject || '')) || SECURITY_BODY.test(String(body || '').slice(0, 1500)); }
export const NOISE_SUBJECT = /^(welcome to chat|tips for using your new inbox|get the official gmail app)/i;
export function isNoiseSubject(subject: string): boolean { return NOISE_SUBJECT.test(String(subject || '').trim()); }

export const INFO_ADDR = 'info@welfareavenue.com';
export const INFO = /(^|[\s<,;"'])info@welfareavenue\.com/i;
/** info@ appears in the addressing headers (mail-pull v10). */
export function toInfo(h: Hdr): boolean {
  return INFO.test([h('To'), h('Cc'), h('X-Original-To'), h('X-Forwarded-For'), h('Delivered-To')].join(','));
}

/* ---- addresses ---- */
export function parseAddr(s: string): { email: string; name: string } {
  const m = String(s || '').match(/^(.*?)<([^>]+)>\s*$/);
  if (m) return { name: m[1].replace(/^\s*"|"\s*$/g, '').trim(), email: m[2].trim().toLowerCase() };
  return { name: '', email: String(s || '').trim().toLowerCase() };
}
export function addrList(s: string): string[] {
  return String(s || '').split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(x => parseAddr(x.trim()).email).filter(e => /@/.test(e));
}
/** The grouping key: lower case and trimmed, the same comparison wa284_contact uses. No dot-folding, no merging. */
export function normKey(addr: string): string { return String(addr || '').trim().toLowerCase(); }
export function domainOf(addr: string): string { return normKey(addr).split('@')[1] || ''; }

/** B2: the mailbox, info@ or one of its aliases appears in To, Cc, Delivered-To or X-Original-To. */
export function addressedToMailbox(h: Hdr, mailbox: string, aliases: string[] = []): boolean {
  const mine = new Set([normKey(mailbox), INFO_ADDR, ...aliases.map(normKey)].filter(Boolean));
  const seen = [...addrList(h('To')), ...addrList(h('Cc')), ...addrList(h('Delivered-To')), ...addrList(h('X-Original-To'))];
  return seen.some(a => mine.has(a));
}

/* ---- text ---- */
/** The new part of a reply: cut the quoted history ("On ... wrote:", "-----Original Message-----", "> " lines). */
export function freshPart(text: string): string {
  const lines = String(text || '').split('\n'), out: string[] = [];
  for (const l of lines) {
    if (/^\s*On .{6,140}wrote:\s*$/i.test(l) || /^\s*Le .{6,140}a écrit\s*:\s*$/i.test(l) || /^-{2,}\s*(Original Message|Forwarded message|Message d'origine|Message transféré)\s*-{2,}/i.test(l) || /^\s*From: .+ Sent: /i.test(l) || /^\s*De : .+ Envoyé : /i.test(l)) break;
    if (/^\s*>/.test(l)) continue;
    out.push(l);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
export function clip(s: unknown, n: number): string {
  const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
}

export const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
export const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|ca|qc\.ca|io|co|info|biz|fr|us|uk|app|dev)(?:\/\S*)?\b/i;
export const PHONE_RE = /(?:\+?\d[\s.()-]*){10,}/;

/** The cleaned subject (5.8): Re:, Fwd:, [External] and tracking tags removed; addresses, phones and long number runs masked; capped. */
export function cleanSubject(s: string, max = 300): string {
  let t = String(s || '').replace(/[\r\n\t]+/g, ' ');
  for (let i = 0; i < 6; i++) {
    const before = t;
    t = t.replace(/^\s*((re|fw|fwd|tr|réf|ref|aw|sv)\s*(\[\d+\])?\s*:\s*)/i, '').replace(/^\s*\[(external|externe|ext|spam|suspicious)\]\s*/i, '');
    if (t === before) break;
  }
  t = t.replace(/\[(?:#|ticket|case|ref)[^\]]{0,30}\]/gi, ' ').replace(/\((?:ref|ticket|case)[:# ][^)]{0,30}\)/gi, ' ');
  t = t.replace(new RegExp(EMAIL_RE.source, 'gi'), '[email]');
  t = t.replace(new RegExp(PHONE_RE.source, 'g'), ' [phone] ');
  t = t.replace(/\d{6,}/g, '[number]');
  return clip(t, max);
}

/** Cut a model's text before the first URL, email address or phone number (M10). Returns '' when nothing is left. */
export function cutAtContact(s: unknown): { text: string; cut: boolean } {
  const t = String(s == null ? '' : s);
  let at = t.length;
  for (const re of [URL_RE, EMAIL_RE, PHONE_RE]) { const m = re.exec(t); if (m && m.index < at) at = m.index; }
  const out = t.slice(0, at).replace(/[\s,;:(\-–]+$/, '').trim();
  return { text: out, cut: at < t.length };
}

/* ---- the rule-only personal filter (rule b, M2) ---- */
export const FREEMAIL_DEFAULT = ['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'hotmail.ca', 'live.com', 'live.ca', 'msn.com', 'yahoo.com', 'yahoo.ca', 'yahoo.fr', 'ymail.com',
  'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'gmx.net', 'mail.com', 'zoho.com', 'videotron.ca', 'bell.net', 'sympatico.ca',
  'rogers.com', 'shaw.ca', 'telus.net', 'cogeco.ca', 'sfr.fr', 'orange.fr', 'free.fr', 'laposte.net'];
/** True when the domain is free mail. A list entry may be a full domain (hotmail.com) or a bare name (hotmail) that matches any of its TLDs. */
export function isFreemail(domain: string, list: string[] = FREEMAIL_DEFAULT): boolean {
  const d = normKey(domain);
  if (!d) return false;
  return list.some(x => {
    const k = normKey(x);
    if (!k) return false;
    if (k.includes('.')) return d === k || d.endsWith('.' + k);
    return d.split('.')[0] === k || d.startsWith(k + '.');
  });
}
/** eh-289 M7: a platform sender. A full domain (stripe.com) matches it or a subdomain; a bare name (stripe) matches only a whole label of the
 *  domain other than its top-level one (mail.stripe.com, stripe.ca), never a part of a label (stripey.org). */
export function isPlatform(domain: string, list: string[] = []): boolean {
  const d = normKey(domain);
  if (!d) return false;
  const labels = d.split('.').slice(0, -1);
  return list.some(x => {
    const k = normKey(x);
    if (!k) return false;
    if (k.includes('.')) return d === k || d.endsWith('.' + k);
    return labels.includes(k);
  });
}
export const PERSONAL_WORDS_DEFAULT = ['birthday', 'condolence', 'condolences', 'funeral', 'wedding', 'mom', 'dad', 'maman', 'papa', 'family dinner', 'vacation photos', 'anniversaire', 'funérailles', 'mariage', 'souper de famille'];
/** Rule b: every outside address is free mail and either the sender shares the owner's family name or the subject has a personal word. */
export function probablyPersonal(p: { outside: string[]; fromName: string; ownerFamily: string | null; subject: string; words?: string[]; freemail?: string[] }): boolean {
  if (!p.outside.length) return false;
  if (!p.outside.every(a => isFreemail(domainOf(a), p.freemail || FREEMAIL_DEFAULT))) return false;
  const fam = normKey(p.ownerFamily || '');
  if (fam && String(p.fromName || '').toLowerCase().split(/[^a-zà-ÿ'-]+/).filter(Boolean).includes(fam)) return true;
  const s = String(p.subject || '').toLowerCase();
  return (p.words || PERSONAL_WORDS_DEFAULT).some(w => { const k = normKey(w); return !!k && new RegExp('(^|[^a-zà-ÿ0-9])' + escapeRe(k) + '([^a-zà-ÿ0-9]|$)').test(s); });
}

/* ---- delivery reports (M6, no model) ---- */
/** Rule e: from mailer-daemon or postmaster, or a multipart/report with delivery-status. */
export function isDeliveryReport(fromEmail: string, contentType: string): boolean {
  const f = normKey(fromEmail);
  return /^(mailer-daemon|postmaster)@/.test(f) || (/multipart\/report/i.test(contentType || '') && /delivery-status/i.test(contentType || ''));
}
/** A message/delivery-status part: Final-Recipient, Action failed and Status 5.x.x make a permanent failure. */
export function parseDeliveryStatus(text: string): { addr: string; code: string } | null {
  const t = String(text || '');
  const blocks = t.split(/\r?\n\s*\r?\n/);
  for (const b of blocks) {
    const rcpt = b.match(/^\s*Final-Recipient\s*:\s*(?:rfc822\s*;)?\s*<?([^\s<>;]+@[^\s<>;]+)>?/im);
    const action = b.match(/^\s*Action\s*:\s*(\S+)/im);
    const status = b.match(/^\s*Status\s*:\s*(\d\.\d{1,3}\.\d{1,3})/im);
    if (rcpt && action && status && /^failed$/i.test(action[1]) && status[1].startsWith('5.')) return { addr: normKey(rcpt[1]), code: status[1] };
  }
  return null;
}
/** A report without the part: exactly one address and an SMTP 550 or 5.1.x in its text. Anything else is ignored. */
export function parseBounceText(text: string, ignore: string[] = []): { addr: string; code: string } | null {
  const t = String(text || '');
  const code = t.match(/\b(550(?:[ -]5\.\d\.\d+)?|5\.1\.\d{1,3})\b/);
  if (!code) return null;
  const skip = new Set(ignore.map(normKey));
  const addrs = Array.from(new Set((t.match(new RegExp(EMAIL_RE.source, 'gi')) || []).map(normKey)))
    .filter(a => !skip.has(a) && !/^(mailer-daemon|postmaster)@/.test(a));
  if (addrs.length !== 1) return null;
  return { addr: addrs[0], code: code[1].startsWith('550') ? '550' : code[1] };
}

/* ---- validation of model answers (M10) ---- */
/** eh-289 I4: the writer asks Welfare Avenue to stop emailing them or to remove them (English and French). Used, without a model, on the emails of
 *  a thread after the reader has already left the thread out, so a later "remove me" is never lost. */
export const STOP_WORDS = /\b(unsubscribe me|remove me|take me off|stop (emailing|e-mailing|sending|contacting|writing to) me|do not (email|contact|write to) me|don'?t (email|contact|write to) me|no longer (wish|want) to (receive|hear|get)|d[ée]sabonnez[- ]moi|me d[ée]sabonner|retirez[- ]moi|enlevez[- ]moi|ne (plus|veux plus|souhaite plus) recevoir|arr[êe]tez de m'?[ée]crire|ne m'?[ée]crivez plus)\b/i;
export function asksToStop(text: string): boolean { return STOP_WORDS.test(String(text || '').slice(0, 4000)); }
export const LEAVE_OUT = ['none', 'personal', 'confidential', 'help_seeker', 'staff_hiring'];
export const TOPICS = ['donation', 'partnership', 'volunteering', 'event', 'media', 'supplier', 'government', 'program', 'other'];
export const LANGS = ['en', 'fr', 'other'];
export const TYPES = ['donor', 'partner', 'volunteer', 'supporter', 'vendor', 'media', 'government', 'other'];
export const ORG_KINDS = ['charity', 'nonprofit', 'business', 'government', 'school', 'faith', 'media', 'foundation', 'other'];

/** A website is kept only when its host is the writer's email domain (or a subdomain of it) or linkedin.com. */
export function websiteOk(url: string, writerDomain: string): string | null {
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(url) ? url : 'https://' + url); } catch (_) { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const dom = normKey(writerDomain).replace(/^www\./, '');
  if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) return 'https://' + u.hostname.toLowerCase() + u.pathname.replace(/\/+$/, '');
  if (dom && (host === dom || host.endsWith('.' + dom))) return 'https://' + u.hostname.toLowerCase() + (u.pathname === '/' ? '' : u.pathname.replace(/\/+$/, ''));
  return null;
}

export type ReadEmail = { n: number; line: string; asks_to_stop: boolean; sig: Record<string, string> | null };
export type ReadResult = { leave_out: string; topic: string; lang: string; emails: ReadEmail[] };
/** Check a read_thread answer. emailsIn lists the emails sent to the model ({n, writerDomain, inbound}).
 *  Returns null (and a reason) when the answer cannot be used; texts with a URL, email or phone are cut before it. */
export function validateRead(raw: unknown, emailsIn: Array<{ n: number; writerDomain: string; inbound: boolean }>, lineMax = 140): { value: ReadResult | null; reason?: string; cuts: number } {
  // deno-lint-ignore no-explicit-any
  const r = raw as any;
  let cuts = 0;
  if (!r || typeof r !== 'object') return { value: null, reason: 'not an object', cuts };
  if (!LEAVE_OUT.includes(r.leave_out)) return { value: null, reason: 'leave_out', cuts };
  const topic = TOPICS.includes(r.topic) ? r.topic : (r.leave_out !== 'none' ? 'other' : null);
  if (!topic) return { value: null, reason: 'topic', cuts };
  const lang = LANGS.includes(r.lang) ? r.lang : 'other';
  if (!Array.isArray(r.emails)) return { value: null, reason: 'emails', cuts };
  const byN = new Map(emailsIn.map(e => [e.n, e]));
  const emails: ReadEmail[] = [];
  for (const e of r.emails) {
    if (!e || typeof e !== 'object') continue;
    const n = Number(e.n);
    const meta = byN.get(n);
    if (!meta || emails.some(x => x.n === n)) continue;
    const c = cutAtContact(e.line);
    if (c.cut) cuts++;
    const line = clip(c.text, lineMax);
    let sig: Record<string, string> | null = null;
    if (meta.inbound && e.sig && typeof e.sig === 'object') {
      const s: Record<string, string> = {};
      for (const k of ['name', 'title', 'organization']) {
        if (typeof e.sig[k] === 'string') { const cc = cutAtContact(e.sig[k]); if (cc.cut) cuts++; const v = clip(cc.text, 120); if (v) s[k] = v; }
      }
      if (typeof e.sig.phone === 'string') { const d = e.sig.phone.replace(/\D/g, ''); if (d.length >= 10 && d.length <= 15) s.phone = d; }
      if (typeof e.sig.website === 'string') { const w = websiteOk(e.sig.website.trim(), meta.writerDomain); if (w) s.website = w; }
      if (Object.keys(s).length) sig = s;
    }
    emails.push({ n, line: r.leave_out === 'none' ? line : '', asks_to_stop: meta.inbound && e.asks_to_stop === true, sig: r.leave_out === 'none' ? sig : null });
  }
  if (r.leave_out === 'none' && !emails.length) return { value: null, reason: 'no emails', cuts };
  return { value: { leave_out: r.leave_out, topic, lang, emails }, cuts };
}

export type OrgFacts = { name?: string; kind?: string; description?: string; street?: string; city?: string; province?: string; postal_code?: string; country?: string; conf: number };
/** Check an org_facts answer: enums, lengths, no URL, email or phone in the texts, a confidence between 0 and 1. Nothing about people. */
export function validateOrg(raw: unknown): { value: OrgFacts | null; reason?: string; cuts: number } {
  // deno-lint-ignore no-explicit-any
  const r = raw as any;
  let cuts = 0;
  if (!r || typeof r !== 'object') return { value: null, reason: 'not an object', cuts };
  const conf = Number(r.confidence ?? r.conf);
  if (!(conf >= 0 && conf <= 1)) return { value: null, reason: 'confidence', cuts };
  const out: OrgFacts = { conf: Math.round(conf * 100) / 100 };
  const caps: Record<string, number> = { name: 120, description: 300, street: 160, city: 80, province: 60, postal_code: 12, country: 60 };
  for (const k of Object.keys(caps)) {
    if (typeof r[k] !== 'string') continue;
    if (k === 'street' || k === 'postal_code') { const v = clip(r[k], caps[k]); if (v && !EMAIL_RE.test(v) && !URL_RE.test(v)) (out as Record<string, unknown>)[k] = v; continue; }
    const c = cutAtContact(r[k]); if (c.cut) cuts++;
    const v = clip(c.text, caps[k]); if (v) (out as Record<string, unknown>)[k] = v;
  }
  if (typeof r.kind === 'string' && ORG_KINDS.includes(r.kind)) out.kind = r.kind;
  if (!out.name && !out.description) return { value: null, reason: 'nothing found', cuts };
  return { value: out, cuts };
}

/* ---- network safety for homepage fetches (M10, R9) ---- */
function v4(ip: string): number[] | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const p = m.slice(1).map(Number);
  return p.every(x => x >= 0 && x <= 255) ? p : null;
}
/** True when an IP address is private, loopback, link-local, carrier-grade NAT, unique-local, unspecified or multicast. */
export function isPrivateIp(ip: string): boolean {
  const s = String(ip || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
  // ::ffff:a.b.c.d (mapped) and ::a.b.c.d (compatible) carry an IPv4 address (eh-289 M4)
  const mapped = s.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
  const a = v4(mapped ? mapped[1] : s);
  if (a) {
    return a[0] === 10 || a[0] === 127 || a[0] === 0 || (a[0] === 172 && a[1] >= 16 && a[1] <= 31) || (a[0] === 192 && a[1] === 168)
      || (a[0] === 169 && a[1] === 254) || (a[0] === 100 && a[1] >= 64 && a[1] <= 127) || a[0] >= 224
      || (a[0] === 198 && (a[1] === 18 || a[1] === 19)) || (a[0] === 192 && a[1] === 0 && a[2] === 0);   // 198.18.0.0/15, 192.0.0.0/24
  }
  if (!s.includes(':')) return true;   // neither IPv4 nor IPv6: refuse
  if (s === '::1' || s === '::') return true;
  if (/^::(ffff:)?[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(s)) {   // the same two, written in hex: ::ffff:a00:1, ::a00:1
    const g = s.split(':').slice(-2).map(x => parseInt(x, 16));
    return isPrivateIp([g[0] >> 8, g[0] & 255, g[1] >> 8, g[1] & 255].join('.'));
  }
  if (/^64:ff9b:/.test(s)) return true;   // 64:ff9b::/96 (NAT64) can reach any IPv4 address: refused
  if (/^2002:/.test(s)) {   // 6to4: the IPv4 address in the next 32 bits
    const g = s.split(':');
    const hi = parseInt(g[1] || '0', 16), lo = parseInt(g[2] || '0', 16);
    return isPrivateIp([hi >> 8, hi & 255, lo >> 8, lo & 255].join('.'));
  }
  const head = parseInt(s.split(':')[0] || '0', 16);
  if ((head & 0xfe00) === 0xfc00) return true;   // fc00::/7 unique local
  if ((head & 0xffc0) === 0xfe80) return true;   // fe80::/10 link local
  if ((head & 0xff00) === 0xff00) return true;   // multicast
  return false;
}
/** A resolved address may be fetched only when it is public and the port is 443. */
export function safeHost(ip: string, port: number | string = 443): boolean {
  const p = port === '' || port == null ? 443 : Number(port);
  return p === 443 && !isPrivateIp(ip);
}
/** The registered domain, roughly (the last two labels; three for .qc.ca and similar). Used to keep redirects inside one domain. */
export function registeredDomain(host: string): string {
  const h = normKey(host).replace(/\.$/, '');
  const parts = h.split('.');
  const three = /\.(qc|on|bc|ab|mb|sk|ns|nb|nl|pe|yt|nt|nu)\.ca$|\.(co|org|gov|ac)\.uk$|\.(com|org|net)\.au$/.test(h);
  return parts.slice(three ? -3 : -2).join('.');
}
/** robots.txt: true when a Disallow: / applies to * or to our agent. */
export function robotsRefuses(txt: string, agent = 'WelfareAvenueHub'): boolean {
  const lines = String(txt || '').split(/\r?\n/).map(l => l.replace(/#.*$/, '').trim());
  let applies = false, inGroup = false, refused = false;
  for (const l of lines) {
    const m = l.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') {
      if (!inGroup) applies = false;
      inGroup = true;
      if (v === '*' || v.toLowerCase() === agent.toLowerCase()) applies = true;
    } else {
      inGroup = false;
      if (applies && k === 'disallow' && v === '/') refused = true;
    }
  }
  return refused;
}
