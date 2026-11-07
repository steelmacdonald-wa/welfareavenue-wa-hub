// wave289, 07/11/26: the email history scan's engine (design "03 email history", 5.1 to 5.5). mail-history's index.ts wires it to Gmail, the
// llm router, the database and the network; the tests (test/w289scan.test.mjs) wire it to invented Gmail responses, a fake router and PGlite.
// No Deno or Node globals here: everything outside comes in through Deps. It never logs or returns an address, subject, line or page text:
// errors are a step name and a status code.
import {
  addrList, addressedToMailbox, asksToStop, clip, cleanSubject, domainOf, freshPart, groupBulk, headerReader, isBulk, isCalendar, isDeliveryReport,
  isFreemail, isGoogleNotice, isNoiseSubject, isPlatform, isSecurity, isWaGroup, neverRead, normKey, parseAddr, parseBounceText, parseDeliveryStatus,
  probablyPersonal, registeredDomain, robotsRefuses, safeHost, TOPICS, TYPES, toInfo, validateOrg, validateRead,
} from './mail_rules.ts';

export type Mailbox = 'steel' | 'hub';
export const MAILBOX_ADDR: Record<Mailbox, string> = { steel: 'steel.macdonald@welfareavenue.com', hub: 'hub@welfareavenue.com' };
export const INFO_ADDR = 'info@welfareavenue.com';
export const USER_AGENT = 'WelfareAvenueHub/1.0 (+https://welfareavenue.com)';

export type HttpResult = { status: number; headers: Record<string, string>; text: string };
export type Deps = {
  // deno-lint-ignore no-explicit-any
  rpc: (fn: string, args: Record<string, unknown>) => Promise<any>;
  scans: (run: number) => Promise<Array<{ mailbox: Mailbox; phase: string; paused: boolean; page_token: string | null; go_at: string | null; estimate_usd: number | null; counts: Record<string, unknown> }>>;
  // deno-lint-ignore no-explicit-any
  gmail: (mailbox: Mailbox, path: string) => Promise<any>;   // throws an Error with .status on an HTTP error
  // deno-lint-ignore no-explicit-any
  router: (task: string, body: Record<string, unknown>) => Promise<{ out: any; cost: number }>;
  resolve: (host: string) => Promise<string[]>;
  http: (url: string, opts: { timeoutMs: number; maxBytes: number }) => Promise<HttpResult>;   // GET, no redirects followed, no cookies
  now: () => number;
  sleep: (ms: number) => Promise<void>;
};

// deno-lint-ignore no-explicit-any
export type Ctx = any;

/* ---- the count phase's query (eh-289 M1: a refused page token relists from since; staging is keyed by id, so nothing doubles) ---- */
export function listQuery(since: string, restartFrom?: string | null): string {
  const d = restartFrom ? restartFrom : since;
  const ymd = String(d).slice(0, 10).replace(/-/g, '/');
  return 'after:' + ymd + ' -in:spam -in:trash -in:chats -in:drafts';
}
export function dayBefore(iso: string): string {
  const t = new Date(iso).getTime() - 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

export const META_HEADERS = ['From', 'To', 'Cc', 'Reply-To', 'Date', 'Subject', 'Message-ID', 'List-Id', 'List-Unsubscribe', 'Precedence', 'Auto-Submitted',
  'Return-Path', 'Delivered-To', 'X-Original-To', 'Content-Type', 'X-Original-Sender', 'Mailing-list'];

/** eh-289 I1: a post Google Groups rewrote for DMARC comes From info@ (or "Name via Info") with the person in X-Original-Sender or a single outside
 *  Reply-To. That person is the writer, and the email is incoming. Returns the writer's address, or null when the From is the real sender. */
export function groupSender(h: (n: string) => string, from: { email: string; name: string }): string | null {
  const rewritten = from.email === INFO_ADDR || / via /i.test(h('From'));
  if (!rewritten) return null;
  const isOurs = (a: string) => a === 'welfareavenue.com' || a.endsWith('@welfareavenue.com');
  const xos = parseAddr(h('X-Original-Sender')).email;
  if (/@/.test(xos) && !isOurs(xos)) return xos;
  const rt = addrList(h('Reply-To')).filter(a => !isOurs(a));
  return rt.length === 1 ? rt[0] : null;
}

/* ---- the headers rules (5.1 table, a to i; h runs in the database) ---- */
// deno-lint-ignore no-explicit-any
export function classify(msg: any, mailbox: Mailbox, ctx: Ctx): Record<string, unknown> {
  const id = String(msg.id);
  const base: Record<string, unknown> = { id, thread: msg.threadId || null, sent_at: msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : null };
  const labels: string[] = msg.labelIds || [];
  if (labels.includes('DRAFT')) return { ...base, state: 'skipped', reason: 'draft' };
  const h = headerReader(msg);
  let from = parseAddr(h('From'));
  const orig = groupSender(h, from);   // I1: the person behind a DMARC-rewritten group post
  if (orig) from = { email: orig, name: from.name.replace(/\s+via\s+.*$/i, '').trim() };
  const subject = h('Subject');
  const ct = h('Content-Type') || String((msg.payload && msg.payload.mimeType) || '');
  const mine = MAILBOX_ADDR[mailbox];
  const own: string[] = ((ctx.own && ctx.own[mailbox]) || []).map(normKey);
  const aliases: string[] = (ctx.aliases || []).map(normKey);
  const all = Array.from(new Set([from.email, ...addrList(h('To')), ...addrList(h('Cc')), ...addrList(h('Reply-To'))].filter(a => /@/.test(a))));
  const outside = all.filter(a => !a.endsWith('@welfareavenue.com'));
  const outsideNoAlias = outside.filter(a => !aliases.includes(a));
  // a. Steel's never-read list (mybox's skipped rows are checked again in the database)
  if (mailbox === 'steel' && neverRead(ctx.owner || null, from.email, subject)) return { ...base, state: 'left_alone', reason: 'personal' };
  // b. probably personal, by rule (M2)
  if (probablyPersonal({ outside: outsideNoAlias, fromName: from.name, ownerFamily: mailbox === 'steel' && ctx.owner ? ctx.owner.family : null, subject, words: ctx.personal_words, freemail: ctx.freemail }))
    return { ...base, state: 'left_alone', reason: 'personal' };
  // c. security
  if (isSecurity(subject)) return { ...base, state: 'left_alone', reason: 'security' };
  // d. calendar
  if (isCalendar(subject, ct)) return { ...base, state: 'skipped', reason: 'calendar' };
  // e. delivery reports go to the bounce parser
  if (isDeliveryReport(from.email, ct)) return { ...base, state: 'skipped', reason: 'bounce' };
  // f. automated, as mybox decides it (for WA's own Google Group, mail-pull's rule instead: eh-289 C1); Google's notices; a platform sender
  //    (whole labels, M7); anything hub@ itself sent
  const dom = domainOf(from.email);
  const bulk = isWaGroup(h) ? groupBulk(h) : isBulk(h, from.email);
  if (bulk || isGoogleNotice(from.email) || isNoiseSubject(subject) || (dom && isPlatform(dom, ctx.platforms || [])) || (mailbox === 'hub' && from.email === mine))
    return { ...base, state: 'skipped', reason: 'automated' };
  // g. list mail not addressed to the mailbox (B2)
  if (h('List-Id') && !addressedToMailbox(h, mine, own)) return { ...base, state: 'skipped', reason: 'list' };
  // i. kept
  const isWA = (a: string) => a === mine || a === INFO_ADDR || a.endsWith('@welfareavenue.com') || own.includes(a) || aliases.includes(a);
  const direction = isWA(from.email) ? 'out' : 'in';
  const row: Record<string, unknown> = { ...base, state: 'kept', direction, box: toInfo(h) ? 'info' : mailbox, outside,
    subject: cleanSubject(subject, (ctx.clips && ctx.clips.subject) || 300), message_id: h('Message-ID') || null };
  if (direction === 'in') { row.writer = from.email; row.writer_name = clip(from.name, 120) || null; }
  else {
    const vis = Array.from(new Set([...addrList(h('To')), ...addrList(h('Cc'))])).filter(a => !isWA(a));
    row.recipients = vis.length <= Number(ctx.max_recipients || 5) ? vis : [];
  }
  return row;
}

/* ---- Gmail with backoff (429 or rateLimitExceeded: 2 s, doubling) ---- */
export async function withBackoff<T>(deps: Deps, fn: () => Promise<T>, startMs = 2000, tries = 5): Promise<T> {
  let wait = startMs;
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      // deno-lint-ignore no-explicit-any
      const st = (e as any)?.status, msg = String((e as any)?.message || '');
      if (i < tries && (st === 429 || (st === 403 && /rateLimitExceeded|userRateLimitExceeded/.test(msg)) || st === 500 || st === 503)) { await deps.sleep(wait); wait *= 2; continue; }
      throw e;
    }
  }
}

/* ---- message text (in memory for one call only) ---- */
function fromB64url(s: string): string {
  const b = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b + '==='.slice((b.length + 3) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
export function stripHtml(html: string): string {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
}
// deno-lint-ignore no-explicit-any
export function partsOf(part: any, out: { text: string[]; html: string[]; dsn: string[] } = { text: [], html: [], dsn: [] }) {
  if (!part) return out;
  const mime = String(part.mimeType || '').toLowerCase();
  if (!part.filename && part.body && part.body.data) {
    const t = fromB64url(part.body.data);
    if (mime === 'text/plain') out.text.push(t); else if (mime === 'text/html') out.html.push(t);
    else if (mime === 'message/delivery-status' || mime === 'message/global-delivery-status') out.dsn.push(t);
  }
  (part.parts || []).forEach((p: unknown) => partsOf(p, out));
  return out;
}
// deno-lint-ignore no-explicit-any
export function textOf(msg: any): string {
  const p = partsOf(msg.payload);
  return (p.text.join('\n').trim() || stripHtml(p.html.join('\n'))).slice(0, 60000);
}

/* ---- the bounce parser (M6) ---- */
// deno-lint-ignore no-explicit-any
export function readBounce(msg: any, mailbox: Mailbox): { addr: string; code: string } | null {
  const p = partsOf(msg.payload);
  for (const d of p.dsn) { const r = parseDeliveryStatus(d); if (r) return r; }
  if (p.dsn.length) return null;
  return parseBounceText(p.text.join('\n') || stripHtml(p.html.join('\n')), [MAILBOX_ADDR[mailbox], INFO_ADDR]);
}

/* ---- every router answer is checked (eh-289 I5, M6): the route that answered must be the one asked, its provider setting must have been sent,
   and its cost must be a number. Otherwise the call is refused and the run pauses (the error carries pause). ---- */
// deno-lint-ignore no-explicit-any
export function checkRouted(task: string, out: any): number {
  const wa = out && out._wa;
  const fail = (why: string) => { const e = new Error('router check: ' + why); (e as any).pause = true; (e as any).status = 'router check'; return e; };
  if (!wa || wa.task !== task) throw fail('another route answered');
  if (!wa.provider || typeof wa.provider !== 'object') throw fail('no provider setting was sent');
  if (typeof wa.cost !== 'number' || !isFinite(wa.cost) || wa.cost < 0) throw fail('no cost');
  return wa.cost;
}

/* ---- the thread reader (5.3) ---- */
export const READ_TOOL = {
  name: 'read_thread',
  description: 'What each email in a Welfare Avenue thread says, for the CRM timeline.',
  input_schema: {
    type: 'object', required: ['leave_out', 'topic', 'lang', 'emails'],
    properties: {
      leave_out: { type: 'string', enum: ['none', 'personal', 'confidential', 'help_seeker', 'staff_hiring'] },
      topic: { type: 'string', enum: TOPICS },
      lang: { type: 'string', enum: ['en', 'fr', 'other'] },
      emails: { type: 'array', items: { type: 'object', required: ['n', 'line', 'asks_to_stop'], properties: {
        n: { type: 'integer' }, line: { type: 'string' }, asks_to_stop: { type: 'boolean' },
        sig: { type: ['object', 'null'], properties: { name: { type: 'string' }, title: { type: 'string' }, organization: { type: 'string' }, phone: { type: 'string' }, website: { type: 'string' } } },
      } } },
    },
  },
};
export const READ_SYSTEM = [
  'You read one email thread from the mailbox of Welfare Avenue, a charity serving people in need in Montreal and Toronto, so the CRM can keep a one-line record of each email.',
  'leave_out: personal (family, friends, health, faith, support groups, personal money), confidential (HR matters about staff or volunteers, board and governance, legal disputes, anyone\'s health, money a person owes), help_seeker (someone asking Welfare Avenue for help for themselves), staff_hiring (applying for a staff or intern role, references); otherwise none.',
  'line: what the email says or asks, in plain words, at most 140 characters. No quotes, no links, no email addresses, no phone numbers, no person named but the writer, nothing about health, family, money a person owes or a private situation. Never use em dashes.',
  'asks_to_stop: true only when the writer asks Welfare Avenue to stop emailing them or to remove them from a list. Give it for every email from outside, even when leave_out is not none.',
  'sig: only for emails from outside, from the writer\'s own sign-off in that email (never a quoted email): name, title, organization, phone, website. Leave out a street address.',
].join('\n');

export function threadPrompt(items: Array<{ n: number; inbound: boolean; date: string; subject: string; text: string }>): string {
  return items.map(i => 'EMAIL ' + i.n + ' (' + (i.inbound ? 'from outside' : 'from Welfare Avenue') + ', ' + i.date.slice(0, 10) + ')\nSubject: ' + i.subject + '\n' + i.text).join('\n\n---\n\n');
}

// deno-lint-ignore no-explicit-any
export async function readThread(deps: Deps, run: number, mailbox: Mailbox, threadId: string, ctx: Ctx, deadline = Infinity): Promise<{ spend: any; rejected: number; calls: number; cost: number }> {
  const rows: Array<{ id: string; direction: string; writer: string | null }> = await deps.rpc('wa289_thread_rows', { p_run: run, p_mailbox: mailbox, p_thread: threadId });
  // deno-lint-ignore no-explicit-any
  let spend: any = null, rejected = 0, calls = 0, cost = 0;
  if (!rows || !rows.length) return { spend, rejected, calls, cost };
  const thread = await withBackoff(deps, () => deps.gmail(mailbox, '/threads/' + encodeURIComponent(threadId) + '?format=full'));
  // deno-lint-ignore no-explicit-any
  const byId = new Map<string, any>(((thread && thread.messages) || []).map((m: any) => [String(m.id), m]));
  const per = Number((ctx.clips && ctx.clips.emails_per_call) || 8), fresh = Number((ctx.clips && ctx.clips.fresh) || 1200);
  for (let i = 0; i < rows.length; i += per) {
    if (i > 0 && deps.now() >= deadline) break;   // eh-289 M2: the rest of the thread waits for the next step (only answered emails are marked read)
    const chunk = rows.slice(i, i + per);
    const items = chunk.map((r, k) => {
      const m = byId.get(r.id);
      const h = headerReader(m);
      return { n: k + 1, id: r.id, inbound: r.direction === 'in', writerDomain: r.writer ? domainOf(r.writer) : 'welfareavenue.com',
        date: m && m.internalDate ? new Date(Number(m.internalDate)).toISOString() : '', subject: cleanSubject(h('Subject')),
        text: m ? clip(freshPart(textOf(m)), fresh) : '' };
    });
    const res = await deps.router('mail_history_thread', { max_tokens: 1400, temperature: 0, system: READ_SYSTEM, messages: [{ role: 'user', content: threadPrompt(items) }],
      tools: [READ_TOOL], tool_choice: { type: 'tool', name: 'read_thread' } });
    calls++; cost += res.cost;
    // deno-lint-ignore no-explicit-any
    const tu = ((res.out && res.out.content) || []).find((c: any) => c && c.type === 'tool_use');
    const v = validateRead(tu ? tu.input : null, items.map(x => ({ n: x.n, writerDomain: x.writerDomain, inbound: x.inbound })), Number((ctx.clips && ctx.clips.line) || 140));
    let result: Record<string, unknown> | null = null;
    if (v.value) {
      result = { leave_out: v.value.leave_out, topic: v.value.topic, lang: v.value.lang,
        emails: v.value.emails.map(e => ({ id: items[e.n - 1].id, line: e.line, asks_to_stop: e.asks_to_stop, sig: e.sig })) };
      if (v.value.leave_out !== 'none') {
        // eh-289 I4: the thread is left out, so its later emails are never sent to the model; a "remove me" in any of them is still kept,
        // by the stop-words rule, before the whole thread is set aside
        const later = rows.slice(i + per).filter(rw => rw.direction === 'in');
        const extra = later.filter(rw => { const m = byId.get(rw.id); return m ? asksToStop(freshPart(textOf(m))) : false; })
          .map(rw => ({ id: rw.id, line: '', asks_to_stop: true, sig: null }));
        (result.emails as unknown[]).push(...extra);
      }
    } else rejected++;
    spend = await deps.rpc('wa289_save_thread', { p_run: run, p_mailbox: mailbox, p_thread: threadId, p_result: result, p_cost: res.cost });
    if (result && result.leave_out !== 'none') break;   // the whole thread is left out
    if (spend && (spend.paused || spend.sample_over)) break;
  }
  return { spend, rejected, calls, cost };
}

/* ---- the writer's type (one Jev decision) ---- */
export const TYPE_CRITERIA: Record<string, string> = {
  donor: 'gives or offers money or goods to Welfare Avenue, or asks how to',
  partner: 'works with Welfare Avenue for an organisation',
  volunteer: 'volunteers with Welfare Avenue or asks to',
  supporter: 'encourages, attends, shares or helps informally',
  vendor: 'sells products or services to Welfare Avenue',
  media: 'covers Welfare Avenue as a journalist or outlet',
  government: 'a public body or an elected office',
  other: 'none of these',
};
// deno-lint-ignore no-explicit-any
export function typeState(p: any, ctx: Ctx): Record<string, unknown> {
  return {
    writer: { display_name: p.name || null, free_mail: isFreemail(p.domain || '', ctx.freemail || []), organization: p.sig ? p.sig.organization || null : null, title: p.sig ? p.sig.title || null : null },
    history: { first: p.first_at, last: p.last_at, emails_in: p.counts ? p.counts.in : null, emails_out: p.counts ? p.counts.out : null, topics: p.topics || [],
      recent: (p.recent || []).map((r: { subject: string; line: string }) => ({ subject: r.subject, line: r.line })) },
  };
}

/* ---- homepage fetch (5.5, M10): robots first, homepage only, public addresses and port 443 only, same registered domain ---- */
export async function fetchSite(deps: Deps, domain: string, lim: { seconds?: number; bytes?: number } = {}): Promise<{ outcome: string; robots: string; url: string | null; text: string | null }> {
  const timeoutMs = Number(lim.seconds || 8) * 1000, maxBytes = Number(lim.bytes || 1048576);
  const root = registeredDomain(domain);
  async function get(url: string, hops = 0): Promise<HttpResult | 'refused'> {
    let u: URL;
    try { u = new URL(url); } catch (_) { return 'refused'; }
    if (u.protocol !== 'https:' || (u.port && u.port !== '443') || u.username || u.password) return 'refused';
    if (registeredDomain(u.hostname) !== root) return 'refused';
    const ips = await deps.resolve(u.hostname).catch(() => [] as string[]);
    if (!ips.length || ips.some(ip => !safeHost(ip, 443))) return 'refused';
    const r = await deps.http(u.toString(), { timeoutMs, maxBytes });
    if (r.status >= 300 && r.status < 400 && r.headers.location && hops < 3) return get(new URL(r.headers.location, u).toString(), hops + 1);
    return r;
  }
  let robots = 'missing';
  try {
    const r = await get('https://' + domain + '/robots.txt');
    if (r === 'refused') return { outcome: 'refused_address', robots, url: null, text: null };
    if (r.status === 200) { robots = robotsRefuses(r.text) ? 'refused' : 'allowed'; if (robots === 'refused') return { outcome: 'robots', robots, url: null, text: null }; }
  } catch (_) { robots = 'missing'; }
  for (const url of ['https://' + domain + '/', 'https://www.' + domain + '/']) {
    try {
      const r = await get(url);
      if (r === 'refused') return { outcome: 'refused_address', robots, url, text: null };
      if (r.status !== 200) continue;
      if (!/text\/html|application\/xhtml/i.test(r.headers['content-type'] || '')) return { outcome: 'not_html', robots, url, text: null };
      return { outcome: 'found', robots, url, text: clip(stripHtml(r.text), 6000) };
    } catch (_) { /* try the next */ }
  }
  return { outcome: 'fetch_failed', robots, url: null, text: null };
}
export const ORG_TOOL = {
  name: 'org_facts',
  description: 'Public facts about an organisation, from its own homepage.',
  input_schema: { type: 'object', required: ['confidence'], properties: {
    name: { type: 'string' }, kind: { type: 'string', enum: ['charity', 'nonprofit', 'business', 'government', 'school', 'faith', 'media', 'foundation', 'other'] },
    description: { type: 'string', description: 'One sentence on what it does, in the site\'s own terms.' },
    street: { type: 'string' }, city: { type: 'string' }, province: { type: 'string' }, postal_code: { type: 'string' }, country: { type: 'string' },
    confidence: { type: 'number' } } },
};
export const ORG_SYSTEM = 'From an organisation\'s homepage text, give its name, kind, one sentence on what it does in the site\'s own terms, and its street address, city, province, postal code and country only if printed on the page. Nothing about people. Never use em dashes.';

/* ---- the estimate (section 7), from the sample's real costs ---- */
export function estimate(sample: { calls: number; cost: number }, sizes: { threads_left: number; writers: number; domains: number; multi: number }, orgCap = 600): number {
  const unit = sample.calls > 0 ? sample.cost / sample.calls : 0.001;
  const threads = sizes.threads_left * 1.1 * unit;
  const types = sizes.writers * 0.00013;
  const orgs = Math.min(sizes.domains, orgCap) * unit * 1.2;
  const summaries = sizes.multi * unit * 4;
  return Math.round((threads + types + orgs + summaries) * 10000) / 10000;
}

/* ---- one step: works until the deadline, then saves and frees the lease ---- */
const PER_BOX = ['count', 'headers', 'bounces', 'threads'];
export async function step(deps: Deps, run: number, budgetMs = 100000): Promise<Record<string, unknown>> {
  const t0 = deps.now(), deadline = t0 + budgetMs;
  const took = await deps.rpc('wa289_lease', { p_run: run });
  if (!took) return { busy: true };
  const done: Record<string, number> = {};
  const bump = (k: string, n = 1) => { done[k] = (done[k] || 0) + n; };
  let where = 'start';
  try {
    // eh-289 I5: the routes are checked at every step, not only at start
    const problems = await deps.rpc('wa289_ready', {});
    if (Array.isArray(problems) && problems.length) {
      await deps.rpc('wa289_pause', { p_run: run, p_on: true, p_by: 'mail-history (not ready)' });
      await deps.rpc('wa289_scan_set', { p_run: run, p_mailbox: null, p_patch: { last_error: 'ready: ' + problems.length + ' problem(s)' } });
      return { ...done, error: 'not ready', paused: true };
    }
    const ctx: Ctx = await deps.rpc('wa289_context', { p_run: run });
    const rate = ctx.read_rate || {}, parallel = Number(rate.parallel || 5), perSecond = Number(rate.per_second || 10), backoff = Number(rate.backoff_ms || 2000);
    while (deps.now() < deadline) {
      const scans = await deps.scans(run);
      if (!scans.length || scans.some(s => s.paused)) break;
      let progressed = false;
      for (const s of scans) {
        if (deps.now() >= deadline) break;
        if (!PER_BOX.includes(s.phase)) continue;
        where = s.phase;
        if (s.phase === 'count') {
          let token = s.page_token, restart: string | null = null;
          let list;
          try {
            list = await withBackoff(deps, () => deps.gmail(s.mailbox, '/messages?maxResults=500&q=' + encodeURIComponent(listQuery(ctx.since, restart)) + (token ? '&pageToken=' + encodeURIComponent(token) : '')), backoff);
          } catch (e) {
            // deno-lint-ignore no-explicit-any
            const st = (e as any)?.status;
            if (token && (st === 400 || st === 404)) {
              restart = null; token = null;   // eh-289 M1: relist from since; ids already staged are kept as they are
              list = await withBackoff(deps, () => deps.gmail(s.mailbox, '/messages?maxResults=500&q=' + encodeURIComponent(listQuery(ctx.since, restart))), backoff);
              bump('restarted');
            } else throw e;
          }
          // deno-lint-ignore no-explicit-any
          const ids = ((list && list.messages) || []).map((m: any) => ({ id: String(m.id), thread: m.threadId ? String(m.threadId) : null }));
          const r = await deps.rpc('wa289_stage_ids', { p_run: run, p_mailbox: s.mailbox, p_ids: ids, p_token: list.nextPageToken || null });
          bump('listed', ids.length); bump('done_at_once', r && r.done ? r.done : 0);
          if (!list.nextPageToken) await deps.rpc('wa289_scan_set', { p_run: run, p_mailbox: s.mailbox, p_patch: { phase: 'headers', page_token: null } });
          progressed = true;
        } else if (s.phase === 'headers') {
          const ids: string[] = await deps.rpc('wa289_todo', { p_run: run, p_mailbox: s.mailbox, p_phase: 'headers', p_limit: 100 });
          if (!ids.length) { await deps.rpc('wa289_scan_set', { p_run: run, p_mailbox: s.mailbox, p_patch: { phase: 'dedupe' } }); progressed = true; continue; }
          const rows: Record<string, unknown>[] = [];
          const q = '?format=metadata' + META_HEADERS.map(x => '&metadataHeaders=' + encodeURIComponent(x)).join('');
          for (let i = 0; i < ids.length && deps.now() < deadline; i += parallel) {
            const g0 = deps.now();
            const group = ids.slice(i, i + parallel);
            const msgs = await Promise.all(group.map(id => withBackoff(deps, () => deps.gmail(s.mailbox, '/messages/' + encodeURIComponent(id) + q), backoff)
              // deno-lint-ignore no-explicit-any
              .catch((e: any) => { if (e && e.status === 404) return { id, gone: true }; throw e; })));
            // deno-lint-ignore no-explicit-any
            msgs.forEach((m: any) => rows.push(m && m.gone ? { id: m.id, state: 'skipped', reason: 'gone' } : classify(m, s.mailbox, ctx)));
            const minMs = Math.ceil(group.length * 1000 / perSecond) - (deps.now() - g0);
            if (minMs > 0) await deps.sleep(minMs);
          }
          if (rows.length) await deps.rpc('wa289_save_headers', { p_run: run, p_mailbox: s.mailbox, p_rows: rows });
          bump('headers', rows.length); progressed = true;
        } else if (s.phase === 'bounces') {
          const ids: string[] = await deps.rpc('wa289_todo', { p_run: run, p_mailbox: s.mailbox, p_phase: 'bounces', p_limit: 50 });
          if (!ids.length) { await deps.rpc('wa289_scan_set', { p_run: run, p_mailbox: s.mailbox, p_patch: { phase: 'sample' } }); progressed = true; continue; }
          for (const id of ids) {
            if (deps.now() >= deadline) break;
            const m = await withBackoff(deps, () => deps.gmail(s.mailbox, '/messages/' + encodeURIComponent(id) + '?format=full'), backoff);
            const b = readBounce(m, s.mailbox);
            await deps.rpc('wa289_save_bounce', { p_run: run, p_mailbox: s.mailbox, p_id: id, p_addr: b ? b.addr : null, p_code: b ? b.code : null });
            bump('bounces');
          }
          progressed = true;
        } else if (s.phase === 'threads') {
          const threads: string[] = await deps.rpc('wa289_todo', { p_run: run, p_mailbox: s.mailbox, p_phase: 'threads', p_limit: 20 });
          if (!threads.length) { await deps.rpc('wa289_scan_set', { p_run: run, p_mailbox: s.mailbox, p_patch: { phase: 'people' } }); progressed = true; continue; }
          for (const t of threads) {
            if (deps.now() >= deadline) break;
            const r = await readThread(deps, run, s.mailbox, t, ctx, deadline);
            bump('threads'); bump('rejected', r.rejected);
            if (r.spend && r.spend.paused) return { ...done, paused: true };
          }
          progressed = true;
        }
      }
      // run-level phases: every scan of the run in the same phase
      const phases = Array.from(new Set(scans.map(s => s.phase)));
      if (phases.length === 1 && deps.now() < deadline) {
        const ph = phases[0];
        where = ph;
        if (ph === 'dedupe') { await deps.rpc('wa289_dedupe', { p_run: run }); bump('dedupe'); progressed = true; }
        else if (ph === 'sample') { await runSample(deps, run, scans.map(s => s.mailbox), ctx, deadline, done); progressed = true; }
        else if (ph === 'people') {
          // eh-289 I2: grouped once, known by its writers count (a status read leaves no empty run object behind)
          if (scans[0].counts?.run?.writers == null) { await deps.rpc('wa289_group', { p_run: run }); bump('grouped'); }
          // deno-lint-ignore no-explicit-any
          const people: any[] = await deps.rpc('wa289_todo', { p_run: run, p_mailbox: null, p_phase: 'people', p_limit: 50 });
          if (!people.length) await deps.rpc('wa289_scan_set', { p_run: run, p_mailbox: null, p_patch: { phase: 'orgs' } });
          for (const p of people) {
            if (deps.now() >= deadline) break;
            const res = await deps.router('mail_history_type', { state: typeState(p, ctx), questions: { type: { type: 'choice',
              instructions: 'What is this person\'s relationship with Welfare Avenue, a charity serving people in need, judged only from the emails they exchanged?', criteria: TYPE_CRITERIA } } });
            const a = (res.out && res.out.answers && res.out.answers.type) || {};
            const choice = TYPES.includes(String(a.choice)) ? String(a.choice) : null;
            const conf = typeof a.confidence === 'number' && a.confidence >= 0 && a.confidence <= 1 ? a.confidence : null;
            const sp = await deps.rpc('wa289_save_person', { p_run: run, p_key: p.key, p_type: choice && conf !== null ? choice : null, p_conf: conf, p_cost: res.cost });
            bump('typed');
            if (sp && sp.paused) return { ...done, paused: true };
          }
          progressed = true;
        } else if (ph === 'orgs') {
          // deno-lint-ignore no-explicit-any
          const todo: any[] = await deps.rpc('wa289_orgs_todo', { p_run: run, p_limit: 20 });
          if (!todo.length) { await deps.rpc('wa289_scan_set', { p_run: run, p_mailbox: null, p_patch: { phase: 'done', finished: true } }); bump('finished'); progressed = true; break; }
          for (const o of todo) {
            if (deps.now() >= deadline) break;
            if (o.over_cap) { await deps.rpc('wa289_save_org', { p_run: run, p_domain: o.domain, p_row: { partner_id: o.partner_id, outcome: 'over_cap' }, p_cost: 0 }); continue; }
            const site = await fetchSite(deps, o.domain, ctx.org_cap || {});
            let row: Record<string, unknown> = { partner_id: o.partner_id, robots: site.robots, url: site.url, outcome: site.outcome };
            let cost = 0;
            if (site.outcome === 'found' && site.text) {
              const res = await deps.router('mail_history_org', { max_tokens: 800, temperature: 0, system: ORG_SYSTEM, messages: [{ role: 'user', content: 'Domain: ' + o.domain + '\n\n' + site.text }],
                tools: [ORG_TOOL], tool_choice: { type: 'tool', name: 'org_facts' } });
              cost = res.cost;
              // deno-lint-ignore no-explicit-any
              const tu = ((res.out && res.out.content) || []).find((c: any) => c && c.type === 'tool_use');
              const v = validateOrg(tu ? tu.input : null);
              if (v.value) { const { conf, ...facts } = v.value; row = { ...row, facts, conf }; } else row = { ...row, outcome: 'none_found' };
            }
            const sp = await deps.rpc('wa289_save_org', { p_run: run, p_domain: o.domain, p_row: row, p_cost: cost });
            bump('orgs');
            await deps.sleep(Number((ctx.org_cap && ctx.org_cap.pause_ms) || 1000));
            if (sp && sp.paused) return { ...done, paused: true };
          }
          progressed = true;
        }
      }
      if (!progressed) break;
    }
    return done;
  } catch (e) {
    // deno-lint-ignore no-explicit-any
    const st = (e as any)?.status, pause = !!(e as any)?.pause;
    if (pause) await deps.rpc('wa289_pause', { p_run: run, p_on: true, p_by: 'mail-history (router check)' }).catch(() => null);   // I5
    await deps.rpc('wa289_scan_set', { p_run: run, p_mailbox: null, p_patch: { last_error: where + ': ' + (pause ? 'router check' : st ? 'HTTP ' + st : String((e as Error)?.name || 'error')) } }).catch(() => null);
    return { ...done, error: where + (pause ? ': router check' : st ? ': HTTP ' + st : ''), ...(pause ? { paused: true } : {}) };
  } finally {
    await deps.rpc('wa289_scan_set', { p_run: run, p_mailbox: null, p_patch: { release: true } }).catch(() => null);
  }
}

/* ---- calibration: 50 random kept threads through the reader (the only spend before go), then the estimate ----
   Resumable without extra state: before go the run's spend is the sample's spend, and the threads read are the sample's threads. */
async function runSample(deps: Deps, run: number, boxes: Mailbox[], ctx: Ctx, deadline: number, done: Record<string, number>) {
  let sizes = await deps.rpc('wa289_sizes', { p_run: run });
  let read = Number(sizes.threads_read || 0), over = false, more = false;
  const per = Math.ceil(50 / boxes.length);
  for (const mb of boxes) {
    if (read >= 50 || over) break;
    const todo: string[] = await deps.rpc('wa289_todo', { p_run: run, p_mailbox: mb, p_phase: 'sample', p_limit: Math.min(per, 50 - read) });
    for (const t of todo) {
      if (deps.now() >= deadline) { more = true; break; }
      if (read >= 50 || over) break;
      const r = await readThread(deps, run, mb, t, ctx, deadline);
      read++; done.sampled = (done.sampled || 0) + 1;
      if (r.spend && r.spend.sample_over) over = true;
    }
  }
  if (more && !over && read < 50) return;   // the next step goes on with the sample
  sizes = await deps.rpc('wa289_sizes', { p_run: run });
  const spent = await deps.rpc('wa289_spend', { p_run: run, p_mailbox: null, p_usd: 0 });
  const sampleCost = Number((spent && spent.spend) || 0);
  // the estimate covers the whole run, the sample already spent included (section 7), so go's cap (1.5 times it) leaves room for the paid phases
  const est = Math.round((sampleCost + estimate({ calls: Number(sizes.threads_read || 0), cost: sampleCost }, sizes, Number((ctx.org_cap && ctx.org_cap.domains) || 600))) * 10000) / 10000;
  await deps.rpc('wa289_scan_set', { p_run: run, p_mailbox: boxes[0], p_patch: { phase: 'waiting', estimate_usd: est } });
  for (const mb of boxes.slice(1)) await deps.rpc('wa289_scan_set', { p_run: run, p_mailbox: mb, p_patch: { phase: 'waiting', estimate_usd: 0 } });
}
