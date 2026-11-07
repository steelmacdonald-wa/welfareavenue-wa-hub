// wave289: the mail-history scan engine, offline. Run: node --test test/w289scan.test.mjs (Node 22.6 or later; PGlite: npm install --no-save @electric-sql/pglite)
// fn/mail-history/scan.ts and fn/_shared/mail_rules.ts are copied side by side into a temporary folder, as the deploy lays them out, and the
// engine runs against: invented Gmail API responses (people at example.org and example.invalid), a fake router that fails on a marker only
// personal mail carries, fake DNS and HTTP, a virtual clock, and PGlite with slice 1's wave281 and wave284 and build/data/wa289_scan.sql loaded.
// No real mailbox, model, network or database is touched.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');
const dir = mkdtempSync(join(tmpdir(), 'w289scan-'));
copyFileSync(join(here, '../fn/mail-history/scan.ts'), join(dir, 'scan.ts'));
copyFileSync(join(here, '../fn/_shared/mail_rules.ts'), join(dir, 'mail_rules.ts'));
const S = await import(pathToFileURL(join(dir, 'scan.ts')).href);

let db;
before(async () => {
  db = new PGlite();
  for (const f of ['w281schema.sql', '../build/data/wa281_rules.sql', 'w284schema.sql', '../build/data/wa284_import.sql', 'w289schema.sql', '../build/data/wa289_scan.sql']) await db.exec(read(f));
});
after(async () => { if (db) await db.close(); rmSync(dir, { recursive: true, force: true }); });

/* ---- invented mail ---- */
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64url');
let seq = 0;
function msg(id, o) {
  const headers = Object.entries({ From: o.from, To: o.to || '', Cc: o.cc || '', Subject: o.subject || 'Test subject', 'Message-ID': o.mid || ('<' + id + '@example.invalid>'), ...(o.headers || {}) })
    .filter(([, v]) => v !== '').map(([name, value]) => ({ name, value }));
  const payload = o.payload || { mimeType: 'text/plain', headers, body: { data: b64(o.body || 'Test body') } };
  if (o.payload) payload.headers = headers;
  return { id, threadId: o.thread || ('t-' + id), labelIds: o.labels || ['INBOX'], internalDate: String(Date.parse(o.date || '2021-03-12T10:00:00Z') + (seq++) * 1000), payload };
}
const STEEL = 'Steel Test <steel.macdonald@welfareavenue.com>';
function mailboxes(tag = '') {
  const I = (x) => x.replace(/^gmail/, 'gmail' + tag);
  const steel = [
    msg(I('gmailA0000001'), { from: 'Test Writer <writer.one@org.example.org>', to: STEEL, subject: 'Partnership idea', thread: 'thA',
      body: 'Hello, can we partner on a food drive?\n\nTest Writer\nDirector, Test Org\n514-555-0101\nhttps://www.org.example.org' }),
    msg(I('gmailA0000002'), { from: STEEL, to: 'writer.one@org.example.org', subject: 'Re: Partnership idea', thread: 'thA', date: '2021-03-13T10:00:00Z',
      body: 'Yes, let us talk next week.\n\nOn Fri, 12 Mar 2021 at 10:00 Test Writer <writer.one@org.example.org> wrote:\n> Hello' }),
    msg(I('gmailA0000003'), { from: 'Cousin <cousin@family.example.invalid>', to: STEEL, subject: 'Hi', body: 'PERSONAL-MARKER family news' }),
    msg(I('gmailA0000004'), { from: 'Aunt Testerson <aunt.t@gmail.com>', to: STEEL, subject: 'Dinner', body: 'PERSONAL-MARKER see you Sunday' }),
    msg(I('gmailA0000005'), { from: STEEL, to: 'draft.person@example.org', subject: 'Draft', labels: ['DRAFT'], body: 'PERSONAL-MARKER never sent' }),
    msg(I('gmailA0000006'), { from: STEEL, to: 'a@example.org, b@example.org, c@example.org', cc: 'd@example.org, e@example.org, f@example.org', subject: 'Season update', thread: 'thM' }),
    msg(I('gmailA0000007'), { from: STEEL, to: 'Quiet One <quiet.one@example.org>', subject: 'Checking in', thread: 'thQ' }),
    msg(I('gmailA0000008'), { from: 'Test Stop <stop.writer@example.org>', to: STEEL, subject: 'About my situation', thread: 'thS', body: 'PERSONAL-STOP Please remove me from your list.' }),
    msg(I('gmailA0000009'), { from: 'Mail Delivery Subsystem <mailer-daemon@googlemail.com>', to: STEEL, subject: 'Delivery Status Notification (Failure)',
      headers: { 'Content-Type': 'multipart/report; report-type=delivery-status; boundary=x' },
      payload: { mimeType: 'multipart/report', parts: [{ mimeType: 'text/plain', body: { data: b64('Address not found') } },
        { mimeType: 'message/delivery-status', body: { data: b64('Reporting-MTA: dns; mx.example.invalid\n\nFinal-Recipient: rfc822; gone.person@example.org\nAction: failed\nStatus: 5.1.1\n') } }] } }),
    msg(I('gmailA0000010'), { from: 'postmaster@example.invalid', to: STEEL, subject: 'Undeliverable', body: 'Your message was delayed; we will keep trying.' }),
    msg(I('gmailA0000011'), { from: 'Writer Two <writer.two@example.org>', to: 'hub@welfareavenue.com', cc: STEEL, subject: 'Volunteering', thread: 'thD', mid: '<dup' + tag + '@example.invalid>' }),
    msg(I('gmailA0000012'), { from: 'News <news@shop.example.invalid>', to: STEEL, subject: 'Sale', headers: { 'List-Unsubscribe': '<mailto:u@shop.example.invalid>' } }),
    msg(I('gmailA0000013'), { from: 'Test Code <no-reply@service.example.invalid>', to: STEEL, subject: 'Your verification code', body: '123456' }),
  ];
  const hub = [
    msg(I('gmailH0000001'), { from: 'Writer Two <writer.two@example.org>', to: 'hub@welfareavenue.com', cc: STEEL, subject: 'Volunteering', thread: 'hD', mid: '<dup' + tag + '@example.invalid>' }),
    msg(I('gmailH0000002'), { from: 'Writer Three <writer.three@neworg.example.org>', to: 'friends@groups.example.invalid', subject: 'Event question', thread: 'hG',
      headers: { 'List-Id': '<friends.groups.example.invalid>', 'List-Unsubscribe': '<mailto:leave@groups.example.invalid>', 'Delivered-To': 'info@welfareavenue.com' } }),
    msg(I('gmailH0000003'), { from: 'Old Writer <old.writer@example.org>', to: 'info@welfareavenue.com', subject: 'Old', thread: 'hO', mid: '<seen-before@example.invalid>' }),
    msg(I('gmailH0000004'), { from: 'List Person <list.person@example.org>', to: 'other-list@groups.example.invalid', subject: 'Not for us', headers: { 'List-Id': '<other.example.invalid>' } }),
  ];
  return { steel, hub };
}

/* ---- the fakes ---- */
function makeDeps(opts = {}) {
  const boxes = opts.boxes || mailboxes(opts.tag || '');
  const calls = { gmail: [], router: [], http: [], fail429: new Set(opts.fail429 || []), seen429: new Set() };
  let clock = 0;
  const deps = {
    rpc: async (fn, args) => {
      const keys = Object.keys(args);
      const vals = keys.map((k) => { const v = args[k]; return v !== null && typeof v === 'object' ? JSON.stringify(v) : v; });
      const sql = 'select public.' + fn + '(' + keys.map((k, i) => k + ' => $' + (i + 1)).join(', ') + ') as r';
      const res = await db.query(sql, vals);
      return res.rows[0].r;
    },
    scans: async (run) => (await db.query(`select mailbox, phase, paused, page_token, go_at, estimate_usd, counts from public.crm_mail_scans where run_id = $1 order by mailbox = 'hub'`, [run])).rows,
    gmail: async (mailbox, path) => {
      calls.gmail.push(mailbox + ' ' + path);
      const list = boxes[mailbox];
      if (path.startsWith('/messages?')) {
        const u = new URL('https://x' + path);
        const token = u.searchParams.get('pageToken');
        if (token === 'STALE') { const e = new Error('gmail 400'); e.status = 400; throw e; }
        const start = token ? Number(token.replace('P', '')) : 0;
        const page = list.slice(start, start + 4);
        return { messages: page.map((m) => ({ id: m.id, threadId: m.threadId })), nextPageToken: start + 4 < list.length ? 'P' + (start + 4) : undefined };
      }
      let m = path.match(/^\/messages\/([^?]+)/);
      if (m) {
        const id = decodeURIComponent(m[1]);
        if (calls.fail429.has(id) && !calls.seen429.has(id)) { calls.seen429.add(id); const e = new Error('gmail 429'); e.status = 429; throw e; }
        const found = list.find((x) => x.id === id);
        if (!found) { const e = new Error('gmail 404'); e.status = 404; throw e; }
        return found;
      }
      m = path.match(/^\/threads\/([^?]+)/);
      if (m) { const t = decodeURIComponent(m[1]); return { id: t, messages: list.filter((x) => x.threadId === t) }; }
      throw new Error('unexpected gmail path');
    },
    router: async (task, body) => {
      const text = JSON.stringify(body);
      if (text.includes('PERSONAL-MARKER')) throw new Error('personal mail reached the router');
      calls.router.push(task);
      const cost = opts.cost !== undefined ? opts.cost : 0.01;
      if (task === 'mail_history_thread') {
        const content = body.messages[0].content;
        const ns = [...content.matchAll(/EMAIL (\d+) \((from outside|from Welfare Avenue)/g)].map((x) => ({ n: Number(x[1]), inbound: x[2] === 'from outside' }));
        if (content.includes('PERSONAL-STOP')) return { out: { content: [{ type: 'tool_use', input: { leave_out: 'personal', topic: 'other', lang: 'en', emails: ns.map((e) => ({ n: e.n, line: 'private', asks_to_stop: e.inbound })) } }] }, cost };
        if (opts.junk) return { out: { content: [{ type: 'tool_use', input: { leave_out: 'maybe' } }] }, cost };
        return { out: { content: [{ type: 'tool_use', input: { leave_out: 'none', topic: 'partnership', lang: 'en', emails: ns.map((e) => ({
          n: e.n, line: e.inbound ? 'Asks to partner; see https://org.example.org/x' : 'WA answers with dates', asks_to_stop: false,
          sig: e.inbound ? { name: 'Test Writer', title: 'Director', organization: 'Test Org', phone: '514-555-0101', website: 'https://www.org.example.org' } : null })) } }] }, cost };
      }
      if (task === 'mail_history_type') return { out: { answers: { type: { choice: 'partner', confidence: 0.9 } } }, cost: 0.00013 };
      if (task === 'mail_history_org') return { out: { content: [{ type: 'tool_use', input: { name: 'Test Org', kind: 'charity', description: 'Feeds families in Montreal.', city: 'Montreal', confidence: 0.8 } }] }, cost };
      throw new Error('unexpected task');
    },
    resolve: async (host) => (opts.dns && opts.dns[host]) || ['93.184.216.34'],
    http: async (url) => {
      calls.http.push(url);
      if (opts.http && opts.http[url]) return opts.http[url];
      if (url.endsWith('/robots.txt')) return { status: 404, headers: {}, text: '' };
      return { status: 200, headers: { 'content-type': 'text/html' }, text: '<html><body><h1>Test Org</h1><p>We feed families.</p></body></html>' };
    },
    now: () => clock,
    sleep: async (ms) => { clock += ms; },
  };
  return { deps, calls, tick: (ms) => { clock += ms; } };
}
async function q(sql, params) { return (await db.query(sql, params)).rows; }
async function newRun(boxes = ['steel', 'hub']) {
  await db.exec(`update public.crm_mail_scans set phase = 'done'`);
  return (await q(`select public.wa289_new_run('Test scan', 'test@example.invalid', $1::text[]) as id`, ['{' + boxes.join(',') + '}']))[0].id;
}

/* ---- pure pieces ---- */
test('the list query leaves out spam, trash, chats and drafts; a refused token restarts one day before the newest date', () => {
  assert.equal(S.listQuery('2020-04-01'), 'after:2020/04/01 -in:spam -in:trash -in:chats -in:drafts');
  assert.equal(S.listQuery('2020-04-01', S.dayBefore('2021-03-12T10:00:00Z')), 'after:2021/03/11 -in:spam -in:trash -in:chats -in:drafts');
});

test('classify: drafts dropped; personal by list and by rule; security, calendar, bounce, automated, list; direction and recipients', () => {
  const ctx = { owner: { skip_senders: ['@family.example.invalid'], skip_words: [], family: 'testerson' }, aliases: ['w289.staff.home@example.invalid'], own: { steel: [], hub: [] },
    personal_words: ['birthday'], platforms: ['stripe'], freemail: ['gmail.com'], max_recipients: 5, clips: { subject: 300 } };
  const { steel, hub } = mailboxes();
  const by = (list, id) => S.classify(list.find((m) => m.id === id), list === steel ? 'steel' : 'hub', ctx);
  assert.equal(by(steel, 'gmailA0000005').reason, 'draft');
  assert.deepEqual([by(steel, 'gmailA0000003').state, by(steel, 'gmailA0000003').reason], ['left_alone', 'personal']);
  assert.deepEqual([by(steel, 'gmailA0000004').state, by(steel, 'gmailA0000004').reason], ['left_alone', 'personal'], 'rule b: free mail and the family name');
  assert.equal(by(steel, 'gmailA0000013').reason, 'security');
  assert.equal(by(steel, 'gmailA0000009').reason, 'bounce');
  assert.equal(by(steel, 'gmailA0000012').reason, 'automated');
  assert.equal(by(hub, 'gmailH0000004').reason, 'list');
  const g = by(hub, 'gmailH0000002');
  assert.equal(g.state, 'kept', 'a person writing through a Google Group to info@ is kept');
  assert.equal(g.box, 'info');
  const out = by(steel, 'gmailA0000006');
  assert.equal(out.direction, 'out'); assert.deepEqual(out.recipients, [], 'a mailing to six adds no one');
  assert.deepEqual(by(steel, 'gmailA0000007').recipients, ['quiet.one@example.org']);
  const inn = by(steel, 'gmailA0000001');
  assert.equal(inn.writer, 'writer.one@org.example.org'); assert.equal(inn.subject, 'Partnership idea'); assert.ok(inn.message_id);
  assert.ok(!JSON.stringify(inn).match(/"(body|snippet|text|html)"/), 'no body leaves classify');
  const fromAlias = S.classify(msg('x1', { from: 'w289.staff.home@example.invalid', to: 'someone@example.org' }), 'hub', ctx);
  assert.equal(fromAlias.direction, 'out', 'a staff alias writing is WA writing');
});

test('the bounce parser: a delivery-status report yields its address and 5.x.x; a non-standard one yields nothing', () => {
  const { steel } = mailboxes();
  assert.deepEqual(S.readBounce(steel.find((m) => m.id === 'gmailA0000009'), 'steel'), { addr: 'gone.person@example.org', code: '5.1.1' });
  assert.equal(S.readBounce(steel.find((m) => m.id === 'gmailA0000010'), 'steel'), null);
});

test('the estimate follows the sample\'s real cost per call', () => {
  assert.equal(S.estimate({ calls: 50, cost: 0.05 }, { threads_left: 5000, writers: 2000, domains: 400, multi: 1200 }), 5.5 + 0.26 + 0.48 + 4.8);
  assert.ok(S.estimate({ calls: 0, cost: 0 }, { threads_left: 10, writers: 1, domains: 0, multi: 0 }) > 0);
});

/* ---- the homepage fetch (M10) ---- */
test('fetchSite: robots, the DNS check and port 443 stop a fetch; only robots.txt and the homepage are fetched', async () => {
  let f = makeDeps({ http: { 'https://org.example.org/robots.txt': { status: 200, headers: {}, text: 'User-agent: *\nDisallow: /' } } });
  let r = await S.fetchSite(f.deps, 'org.example.org');
  assert.equal(r.outcome, 'robots'); assert.deepEqual(f.calls.http, ['https://org.example.org/robots.txt']);

  f = makeDeps({ dns: { 'org.example.org': ['10.0.0.5'] } });
  r = await S.fetchSite(f.deps, 'org.example.org');
  assert.equal(r.outcome, 'refused_address'); assert.deepEqual(f.calls.http, [], 'a private address is never requested');

  f = makeDeps({ dns: { 'org.example.org': ['93.184.216.34', '169.254.169.254'] } });
  assert.equal((await S.fetchSite(f.deps, 'org.example.org')).outcome, 'refused_address', 'any private answer refuses the host');

  f = makeDeps({ http: { 'https://org.example.org/': { status: 301, headers: { location: 'https://org.example.org:8443/' }, text: '' } } });
  assert.equal((await S.fetchSite(f.deps, 'org.example.org')).outcome, 'refused_address', 'a redirect to another port is refused');

  f = makeDeps({ http: { 'https://org.example.org/': { status: 302, headers: { location: 'https://elsewhere.example.net/' }, text: '' } } });
  assert.equal((await S.fetchSite(f.deps, 'org.example.org')).outcome, 'refused_address', 'a redirect to another domain is refused');

  f = makeDeps({ http: { 'https://org.example.org/': { status: 301, headers: { location: 'https://www.org.example.org/' }, text: '' } } });
  r = await S.fetchSite(f.deps, 'org.example.org');
  assert.equal(r.outcome, 'found'); assert.match(r.text, /We feed families/);
  assert.deepEqual(f.calls.http, ['https://org.example.org/robots.txt', 'https://org.example.org/', 'https://www.org.example.org/'], 'only the homepage, through one same-domain redirect');
  assert.ok(f.calls.http.every((u) => /^https:\/\//.test(u)));

  f = makeDeps({ http: { 'https://org.example.org/': { status: 200, headers: { 'content-type': 'application/pdf' }, text: '%PDF' } } });
  assert.equal((await S.fetchSite(f.deps, 'org.example.org')).outcome, 'not_html');
});

/* ---- a whole run ---- */
test('a run end to end: free phases, the sample and estimate, go, threads, people, organisations; nothing personal reaches the router', async () => {
  // an earlier run kept a message with this Message-ID
  await db.query(`insert into import_stage.mail_seen (msg_md5, mailbox, gmail_id, run_id) values (md5(lower('<seen-before@example.invalid>')), 'hub', 'gmailOLD00001', null)`);
  const run = await newRun();
  const f = makeDeps({ fail429: ['gmailA0000006'] });
  const r1 = await S.step(f.deps, run, 100000);
  assert.ok(!r1.error, 'the first step ran: ' + JSON.stringify(r1));
  assert.ok(f.calls.gmail.some((p) => p.includes(encodeURIComponent('-in:drafts'))), 'the list query carries -in:drafts');
  assert.equal(f.calls.gmail.filter((p) => p.startsWith('steel /messages/gmailA0000006')).length, 2, 'a 429 retries the same id');
  const scans = await q(`select mailbox, phase, estimate_usd from public.crm_mail_scans where run_id = $1 order by mailbox`, [run]);
  assert.deepEqual(scans.map((s) => s.phase), ['waiting', 'waiting'], 'the free phases end waiting for go');
  assert.ok(Number(scans.find((s) => s.mailbox === 'steel').estimate_usd) > 0, 'the sample set an estimate');
  const states = Object.fromEntries((await q(`select gmail_id, state || ':' || coalesce(reason, '') as s from import_stage.mail_messages where run_id = $1`, [run])).map((x) => [x.gmail_id, x.s]));
  assert.equal(states.gmailA0000005, 'skipped:draft', 'the DRAFT label is dropped (M5)');
  assert.equal(states.gmailA0000003, 'left_alone:personal'); assert.equal(states.gmailA0000004, 'left_alone:personal');
  assert.equal(states.gmailH0000001, 'skipped:duplicate', "hub@'s copy of the same email is the duplicate");
  assert.equal(states.gmailA0000011, 'kept:', 'Steel\'s copy is kept');
  assert.equal(states.gmailH0000003, 'done:seen', 'a message an earlier run kept is skipped');
  assert.equal(states.gmailH0000002, 'kept:', 'the Google Group mail to info@ is kept');
  assert.equal(states.gmailH0000004, 'skipped:list');
  assert.equal((await q(`select bounce_addr from import_stage.mail_messages where run_id = $1 and gmail_id = 'gmailA0000009'`, [run]))[0].bounce_addr, 'gone.person@example.org');
  assert.equal((await q(`select bounce_addr from import_stage.mail_messages where run_id = $1 and gmail_id = 'gmailA0000010'`, [run]))[0].bounce_addr, null);
  const spend = (await q(`select sum(spend_usd)::float as s from public.crm_mail_scans where run_id = $1`, [run]))[0].s;
  assert.ok(spend > 0 && spend <= 0.25, 'the sample stays under its cap: ' + spend);
  // the left-out thread: asks-to-stop and the key, nothing else
  const stop = (await q(`select state, reason, asks_to_stop, writer, subject, line, sig from import_stage.mail_messages where run_id = $1 and gmail_id = 'gmailA0000008'`, [run]))[0];
  assert.deepEqual(stop, { state: 'left_alone', reason: 'personal', asks_to_stop: true, writer: 'stop.writer@example.org', subject: null, line: null, sig: null });
  // lines are validated: the URL is cut
  assert.equal((await q(`select line from import_stage.mail_messages where run_id = $1 and gmail_id = 'gmailA0000001'`, [run]))[0].line, 'Asks to partner; see');
  const threadCalls = f.calls.router.filter((t) => t === 'mail_history_thread').length;

  await q(`select public.wa289_go($1, 'test@example.invalid')`, [run]);
  const r2 = await S.step(f.deps, run, 100000);
  assert.ok(!r2.error, 'the paid step ran: ' + JSON.stringify(r2));
  assert.equal(f.calls.router.filter((t) => t === 'mail_history_thread').length, threadCalls, 'threads read in the sample are never read again');
  assert.deepEqual((await q(`select distinct phase from public.crm_mail_scans where run_id = $1`, [run])).map((x) => x.phase), ['done']);
  const people = Object.fromEntries((await q(`select key, writer, optout, rel_type, sig, counts from import_stage.mail_people where run_id = $1`, [run])).map((p) => [p.key, p]));
  assert.ok(people['writer.one@org.example.org'].writer && people['writer.one@org.example.org'].rel_type === 'partner', 'the writer is grouped and typed');
  assert.equal(people['writer.one@org.example.org'].sig.phone, '5145550101');
  assert.ok(!people['quiet.one@example.org'], 'an outbound-only recipient is not grouped');
  assert.ok(!people['a@example.org'], "a mailing's recipients add no one");
  assert.equal(people['stop.writer@example.org'].writer, false); assert.equal(people['stop.writer@example.org'].optout, 'asked_to_stop');
  assert.equal(people['gone.person@example.org'].optout, 'bounced');
  const runCounts = (await q(`select counts -> 'run' as c from public.crm_mail_scans where run_id = $1 and mailbox = 'steel'`, [run]))[0].c;
  assert.equal(runCounts.outbound_only, 1, 'the outbound-only recipient is counted');
  const org = (await q(`select outcome, facts from import_stage.mail_orgs where run_id = $1 and domain = 'org.example.org'`, [run]))[0];
  assert.equal(org.outcome, 'found'); assert.equal(org.facts.name, 'Test Org');
  assert.ok(f.calls.http.every((u) => /^https:\/\/(www\.)?[a-z.]+\/(robots\.txt)?$/.test(u)), 'only robots.txt and homepages: ' + f.calls.http.join(' '));

  // a resumed step repeats no paid call
  const before = f.calls.router.length;
  await q(`update public.crm_mail_scans set phase = 'threads' where run_id = $1`, [run]);
  await S.step(f.deps, run, 100000);
  assert.equal(f.calls.router.filter((t) => t === 'mail_history_thread').length, threadCalls, 'no thread is read twice after a restart');
  assert.equal(f.calls.router.length, before, 'no router call at all: types and organisations are not repeated either');
  const status = (await q(`select public.wa289_status($1) as s`, [run]))[0].s;
  assert.ok(!JSON.stringify(status).includes('@'), 'status holds no address');
});

test('a step stopped by its budget resumes where it was, and a refused page token restarts from the newest date', async () => {
  const run = await newRun(['steel']);
  const f = makeDeps({ tag: 'B' });
  // a tiny budget: the step stops early; the next one goes on
  let guard = 0;
  while ((await q(`select phase from public.crm_mail_scans where run_id = $1`, [run]))[0].phase !== 'waiting' && guard++ < 60) {
    const r = await S.step(f.deps, run, 300);
    assert.ok(!r.error, JSON.stringify(r));
    f.tick(1);
  }
  assert.ok(guard < 60, 'the run reached waiting in small steps');
  const threads = (await q(`select count(distinct thread_id)::int as n from import_stage.mail_messages where run_id = $1 and read_at is not null`, [run]))[0].n;
  assert.ok(threads >= 5, 'threads were read: ' + threads);
  assert.equal(f.calls.router.filter((t) => t === 'mail_history_thread').length, threads, 'one reader call per thread, none repeated across steps');

  const run2 = await newRun(['steel']);
  await q(`select public.wa289_stage_ids($1, 'steel', '[{"id": "gmailA0000001", "thread": "thA"}]', 'STALE')`, [run2]);
  await q(`update import_stage.mail_messages set sent_at = '2021-03-12T10:00:00Z' where run_id = $1`, [run2]);
  const g = makeDeps({ tag: 'B' });
  const r = await S.step(g.deps, run2, 100000);
  assert.ok(!r.error, JSON.stringify(r));
  assert.ok(g.calls.gmail.some((p) => p.includes(encodeURIComponent('after:2021/03/11'))), 'listing restarted one day before the newest date: ' + g.calls.gmail[1]);
  assert.equal((await q(`select count(*)::int as n from import_stage.mail_messages where run_id = $1 and gmail_id = 'gmailA0000001'`, [run2]))[0].n, 1, 'nothing doubles');
});

test('the sample cap stops the sample; after go the cap pauses the run; rejected answers are counted, not staged', async () => {
  const run = await newRun(['steel']);
  const f = makeDeps({ cost: 0.2, tag: 'C' });
  await S.step(f.deps, run, 100000);
  const s = (await q(`select phase, spend_usd::float as spend from public.crm_mail_scans where run_id = $1`, [run]))[0];
  assert.equal(s.phase, 'waiting');
  assert.equal(f.calls.router.length, 2, 'the sample stops once its spend reaches the sample cap (two calls at 0.20)');
  await q(`select public.wa289_go($1, 'test@example.invalid')`, [run]);
  await q(`update public.crm_mail_scans set cap_usd = 0.5 where run_id = $1`, [run]);
  const r = await S.step(f.deps, run, 100000);
  assert.equal(r.paused, true, 'the cap pauses the run: ' + JSON.stringify(r));
  assert.equal((await q(`select paused from public.crm_mail_scans where run_id = $1`, [run]))[0].paused, true);
  const calls = f.calls.router.length;
  await S.step(f.deps, run, 100000);
  assert.equal(f.calls.router.length, calls, 'a paused run makes no call');

  const run2 = await newRun(['steel']);
  const j = makeDeps({ junk: true, tag: 'D' });
  await S.step(j.deps, run2, 100000);
  const rej = (await q(`select count(*)::int as n from import_stage.mail_messages where run_id = $1 and read_fail > 0 and line is null`, [run2]))[0].n;
  assert.ok(rej > 0, 'a rejected answer stages nothing and is counted');
});
