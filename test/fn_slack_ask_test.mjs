/* fn_slack_ask_test.mjs (wave323): Ask the Hub in Slack, end to end, with no network.
   The two functions run together under Node (test/fn_harness.mjs): slack-command receives signed Slack requests, calls the
   real ask function in the same process over the trusted path, and ask calls a mock model. Slack's API is a mock that
   records what would have been posted. Checks: who may ask, what the model is told about them, what never reaches the
   context, that nothing a person typed is stored, the cards and their buttons, and the limit.
   usage: node test/fn_slack_ask_test.mjs */
import { createHmac } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { makeDb, loadFn, makeFetch } from './fn_harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASK = path.join(HERE, '../fn/ask/index.ts');
const SLACKFN = path.join(HERE, '../fn/slack-command/index.ts');
const SB = 'http://sb.test', SLACK = 'http://slack.test/api', HOOK = 'http://hooks.test/resp/';
const TEAM = 'TTESTTEAM01';
const ENV = { SUPABASE_URL: SB, SUPABASE_ANON_KEY: 'anon-key', SUPABASE_SERVICE_ROLE_KEY: 'service-key', SLACK_API_BASE: SLACK };

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 700) : '')); } };
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const tsNow = () => String(Math.floor(Date.now() / 1000));
const slackTs = (secAgo) => (Date.now() / 1000 - secAgo).toFixed(6);

/* ---------------- the world ---------------- */
function world(over) {
  const secrets = Object.assign({ SLACK_SIGNING_SECRET: 'sign-secret', SLACK_BOT_TOKEN: 'xoxb-test', WA_TRIGGER_SECRET: 'trigger-secret', OPENROUTER_API_KEY: null }, (over && over.secrets) || {});
  const db = makeDb({
    unique: { slack_ask_log: ['event_id'] },
    uuid: ['slack_ask_pending'],
    tables: {
      team_members: [
        { id: 1, name: 'Ann Lee', email: 'ann@welfareavenue.com', department: 'marketing', role: 'Writer', active: true },
        { id: 2, name: 'Joanna Park', email: 'Joanna@WelfareAvenue.com', department: 'marketing', role: 'Designer', active: true },
        { id: 3, name: 'Gone Person', email: 'gone@welfareavenue.com', department: 'opsmtl', role: 'Operations', active: false },
        { id: 4, name: 'New Bie', email: 'newbie@welfareavenue.com', department: 'opsmtl', role: 'Operations', active: true },
        { id: 5, name: 'No Email', email: '', department: 'opsmtl', role: 'Operations', active: true },
        { id: 6, name: 'Board Friend', email: 'friend@example.org', department: 'board', role: 'Board member', active: true }
      ],
      wa_slack_ids: [
        { email: 'ann@welfareavenue.com', slack_id: 'UANN' },
        { email: 'joanna@welfareavenue.com', slack_id: 'UJO' },
        { email: 'gone@welfareavenue.com', slack_id: 'UGONE' },
        { email: 'friend@example.org', slack_id: 'UFRIEND' }
      ],
      dept_tasks: [
        { id: 1, department: 'marketing', title: 'Send the partner thank-you notes', owner: 'Ann', due_date: day(-3), done: false, flag: false },
        { id: 2, department: 'marketing', title: 'Draft the newsletter', owner: 'Ann Lee', due_date: day(2), done: false, flag: true },
        { id: 3, department: 'marketing', title: 'Plan the reel', owner: 'Joanna', due_date: day(-1), done: false },
        { id: 4, department: 'marketing', title: 'A private matter', owner: 'Ann', due_date: day(-2), done: false, confidential: true },
        { id: 5, department: 'board', title: 'Board pack pages', owner: 'Ann', due_date: day(-2), done: false },
        { id: 6, department: 'marketing', title: 'Restricted thing', owner: 'Ann', due_date: day(-2), done: false, visibility: 'people' },
        { id: 7, department: 'marketing', title: 'Banked thing', owner: 'Ann', done: false, banked_at: '2026-10-01T00:00:00Z' },
        { id: 8, department: 'opsmtl', title: 'Count the aprons', owner: 'Team', done: false },
        { id: 9, department: 'marketing', title: 'Done thing', owner: 'Ann', done: true },
        { id: 10, department: 'marketing', title: 'Plan for Steel stepping down', owner: 'Ann', due_date: day(-5), done: false },
        { id: 11, department: 'marketing', title: 'Board only thing', owner: 'Ann', done: false, board_only: true },
        { id: 12, department: 'marketing', title: 'Unsure whose', owner: 'Someone', done: false, owner_unsure: true },
        { id: 13, department: 'marketing', title: 'Friend task', owner: 'Board Friend', done: false },
        { id: 14, department: 'opsmtl', title: 'Order the pots', owner: 'Team', due_date: day(5), done: false, project_id: 50 }
      ],
      task_assignees: [{ task_id: 8, member_id: 1 }, { task_id: 12, member_id: 1 }],
      dept_requests: [
        { id: 30, title: 'Poster for Sunday', department: 'marketing', status: 'requested', type_key: 'design', assignee: 'Ann Lee', done: false, created_at: '2026-11-01T00:00:00Z' },
        { id: 31, title: 'Reel for the drive', department: 'marketing', status: 'requested', type_key: 'design', assignee: 'Joanna', done: false, created_at: '2026-11-02T00:00:00Z' },
        { id: 32, title: 'Time away', department: 'hr', status: 'requested', type_key: 'time-off', assignee: 'Ann Lee', done: false, created_at: '2026-11-03T00:00:00Z' }
      ],
      request_types: [{ key: 'design', label: 'Design', department: 'marketing', enabled: true, sort: 1 }, { key: 'other', label: 'Other', department: 'marketing', enabled: true, sort: 9 }],
      board_circle: [], hub_roles: [], slack_ask_log: [], slack_ask_pending: [], wa_change_requests: [], change_log: [], projects: [{ id: 50, name: 'Community Kitchen', department: 'opsmtl', status: 'active', banked_at: null }]
    },
    rpc: {
      get_secret: (a) => secrets[a.secret_name] || null,
      wa_ask_meetings: async (_a, client) => { meet.calls.push(client.kind); if (meet.delay) await new Promise((r) => setTimeout(r, meet.delay)); return []; }
    },
    authUser: (h) => (h.Authorization === 'Bearer jwt-ann' ? { email: 'ann@welfareavenue.com' } : h.Authorization === 'Bearer jwt-jo' ? { email: 'joanna@welfareavenue.com' } : null)
  });
  const meet = { calls: [], delay: 0 };
  /* the columns' defaults in the real table */
  db.tables.dept_tasks.forEach((t) => { for (const [k, v] of Object.entries({ board_only: false, confidential: false, visibility: null, banked_at: null, owner_unsure: false, flag: false, due_date: null })) if (t[k] === undefined) t[k] = v; });
  return { db, secrets, meet };
}

const ANSWER_MD = 'You have **one task past its date**: Send the partner thank-you notes.\n\n- Draft the newsletter is due soon\n- See [Home](#mypage) and [the grant doc](https://docs.example.org/d/1?a=1&b=2)\n\nFish & chips < 5 :wa-arrow-go:';
function answerCall(text, sources) { return { content: [{ type: 'tool_use', id: 'a1', name: 'answer_question', input: { answer: text, sources: sources || ['Marketing meeting, Nov 3'] } }] }; }

async function stage(over) {
  const w = world(over);
  const calls = [];
  const llm = { fn: null, seen: [] };
  const slackState = { history: [], ts: 100, info: {} };
  const fns = {};
  globalThis.fetch = makeFetch([
    [(u) => u === SB + '/functions/v1/ask', async (_u, init) => {
      if (over && over.askDown) return new Response('down', { status: 500 });
      return fns.ask.call(new Request(SB + '/functions/v1/ask', { method: 'POST', headers: init.headers, body: init.body }));
    }],
    [(u) => u === SB + '/functions/v1/llm', async (_u, init, rec) => { llm.seen.push(rec); return llm.fn ? llm.fn(rec.json, rec) : answerCall(ANSWER_MD); }],
    [(u) => u === SB + '/functions/v1/notify', async () => ({ ok: true })],
    [(u) => u.indexOf(SLACK + '/conversations.history') === 0 || u.indexOf(SLACK + '/conversations.replies') === 0, async () => ({ ok: true, messages: slackState.history })],
    [(u) => u.indexOf(SLACK + '/users.info') === 0, async (u) => { const id = new URL(u).searchParams.get('user'); return slackState.info[id] ? { ok: true, user: slackState.info[id] } : { ok: false, error: 'user_not_found' }; }],
    [(u) => u === SLACK + '/auth.test', async () => ({ ok: true, team_id: TEAM, user_id: 'UBOTSELF' })],
    [(u) => u.indexOf(SLACK + '/assistant.') === 0, async () => ({ ok: true })],
    [(u) => u.indexOf(SLACK + '/chat.') === 0, async () => ({ ok: true, ts: '17000000' + (slackState.ts++) + '.000100', channel: 'D1' })],
    [(u) => u.indexOf(HOOK) === 0, async () => new Response('ok', { status: 200 })]
  ], calls);
  fns.ask = await loadFn(ASK, { env: ENV, db: w.db });
  fns.slack = await loadFn(SLACKFN, { env: Object.assign({}, ENV, (over && over.env) || {}), db: w.db });
  const sign = (raw, ts, secret) => 'v0=' + createHmac('sha256', secret || 'sign-secret').update('v0:' + ts + ':' + raw).digest('hex');
  const post = async (raw, type, opt) => {
    const ts = (opt && opt.ts) || tsNow();
    const headers = { 'content-type': type };
    if (!(opt && opt.unsigned)) { headers['x-slack-request-timestamp'] = ts; headers['x-slack-signature'] = (opt && opt.sig) || sign(raw, ts, opt && opt.secret); }
    const res = await fns.slack.call(new Request('http://fn.test/slack-command', { method: 'POST', headers, body: raw }));
    const text = await res.text();
    await fns.slack.drain();
    return { status: res.status, text, json: (() => { try { return JSON.parse(text); } catch (_) { return null; } })() };
  };
  let evN = 0;
  const event = (ev, extra) => post(JSON.stringify(Object.assign({ type: 'event_callback', team_id: TEAM, event_id: 'Ev' + (++evN) + Math.random().toString(36).slice(2, 8), event: ev }, extra || {})), 'application/json');
  const dm = (user, text, extra) => event(Object.assign({ type: 'message', channel_type: 'im', channel: 'D1', user, text, ts: slackTs(1) }, extra || {}));
  const slash = (user, text, n) => post(new URLSearchParams({ command: '/hub', team_id: TEAM, user_id: user, user_name: 'someone', text, response_url: HOOK + (n || 1) }).toString(), 'application/x-www-form-urlencoded');
  const click = (user, action, value, n) => post(new URLSearchParams({ payload: JSON.stringify({ type: 'block_actions', team: { id: TEAM }, user: { id: user }, response_url: HOOK + (n || 9), actions: [{ action_id: action, value }] }) }).toString(), 'application/x-www-form-urlencoded');
  const slackCalls = (m) => calls.filter((c) => c.url.indexOf(SLACK + '/' + m) === 0);
  const hooks = () => calls.filter((c) => c.url.indexOf(HOOK) === 0);
  const askCalls = () => calls.filter((c) => c.url === SB + '/functions/v1/ask');
  const reset = () => { calls.length = 0; llm.seen.length = 0; w.meet.calls.length = 0; };
  const quiet = () => calls.filter((c) => c.url !== SLACK + '/auth.test');
  const askDirect = (headers, body) => fns.ask.call(new Request(SB + '/functions/v1/ask', { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, headers), body: JSON.stringify(body) })).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));
  const ctx = (i) => { const rec = llm.seen[i == null ? llm.seen.length - 1 : i]; if (!rec) return ''; const m = rec.json.messages; const last = m[m.length - 1]; return typeof last.content === 'string' ? last.content : JSON.stringify(last.content); };
  return { w, db: w.db, calls, llm, slackState, post, event, dm, slash, click, slackCalls, hooks, askCalls, reset, askDirect, ctx, sign, fns, quiet };
}
const TRUST = { 'x-wa-secret': 'trigger-secret', 'x-wa-via': 'slack', Authorization: 'Bearer service-key' };
const allText = (db) => JSON.stringify(db.tables);

/* =================== A. the ask function =================== */
{
  const s = await stage();
  let r = await s.askDirect({}, { question: 'hello' });
  ok('ask: no sign-in, no answer', r.status === 401);
  r = await s.askDirect({ 'x-wa-secret': 'wrong', 'x-wa-as': 'ann@welfareavenue.com' }, { question: 'hello' });
  ok('ask: a wrong secret cannot name a person', r.status === 401);
  r = await s.askDirect(Object.assign({}, TRUST, { 'x-wa-as': 'nobody@welfareavenue.com' }), { question: 'hello' });
  ok('ask: the trusted path refuses an email that is not on the roster', r.status === 401);
  r = await s.askDirect(Object.assign({}, TRUST, { 'x-wa-as': 'gone@welfareavenue.com' }), { question: 'hello' });
  ok('ask: the trusted path refuses someone who is no longer active', r.status === 401);
  ok('ask: none of those reached the model', s.llm.seen.length === 0);

  s.reset();
  r = await s.askDirect(Object.assign({}, TRUST, { 'x-wa-as': 'Ann@WelfareAvenue.com' }), { question: 'Which of my tasks are overdue?' });
  let c = s.ctx();
  ok('ask (Slack path): answers for an active roster person', r.status === 200 && typeof r.json.answer === 'string' && r.json.answer.length > 10, r);
  ok('ask (Slack path): the context says who is asking', /WHO IS ASKING: Ann Lee \(Marketing\)/.test(c), c.slice(0, 400));
  ok('ask (Slack path): the context says what day it is', /TODAY IS \w+day,? \d{1,2} \w+ \d{4} \(\d{4}-\d{2}-\d{2}\)/.test(c), c.slice(0, 400));
  ok('ask (Slack path): their tasks, counted, overdue first', /THEIR OPEN TASKS \(3 open, 1 past the due date/.test(c) && c.indexOf('1. Send the partner thank-you notes') < c.indexOf('2. Draft the newsletter') && /1\. Send the partner thank-you notes \(Marketing, due \d{4}-\d{2}-\d{2}, OVERDUE by 3 days\)/.test(c) && /2\. Draft the newsletter \(Marketing, due \d{4}-\d{2}-\d{2} \(in 2 days\), flagged\)/.test(c), c.slice(0, 900));
  if (process.env.DUMP) console.log('---- the opening of the context ----\n' + c.slice(0, c.indexOf('OPEN REQUESTS')));
  ok('ask (Slack path): a task assigned to them without their name counts', /8\. Count the aprons/.test(c));
  const mineBlock = c.slice(c.indexOf('THEIR OPEN TASKS'), c.indexOf('REQUESTS WAITING ON THEM') > 0 ? c.indexOf('REQUESTS WAITING ON THEM') : c.indexOf('THEIR OPEN TASKS') + 1200);
  ok('ask (Slack path): a name inside another name is not theirs (Ann is not Joanna)', mineBlock.indexOf('Plan the reel') < 0 && mineBlock.indexOf('Send the partner') > 0);
  ok('ask (Slack path): their list leaves out confidential, board, restricted, banked, done, board-only, unsure and off-limits titles',
    ['A private matter', 'Board pack pages', 'Restricted thing', 'Banked thing', 'Done thing', 'stepping down', 'Board only thing', 'Unsure whose', 'Plan the reel'].every((t) => mineBlock.indexOf(t) < 0), mineBlock);
  /* (a restricted task is kept out of the other blocks by the database's own filter, which this stand-in does not model, and a
     banked task belongs in the IN THE BANK block: both are checked in their own list above) */
  ok('ask (Slack path): nowhere in the context: confidential, Board team, board-only, off-limits titles', ['A private matter', 'Board pack pages', 'stepping down', 'Board only thing'].every((t) => c.indexOf(t) < 0), ['A private matter', 'Board pack pages', 'stepping down', 'Board only thing'].filter((t) => c.indexOf(t) >= 0));
  ok('ask (Slack path): the requests waiting on them, not on others, never time off', /REQUESTS WAITING ON THEM \(1;/.test(c) && /30\. Poster for Sunday/.test(c) && !/REQUESTS WAITING ON THEM[^\n]*\n[^\n]*\n31\./.test(c) && c.indexOf('Time away') < 0, c.slice(c.indexOf('REQUESTS WAITING'), c.indexOf('REQUESTS WAITING') + 300));
  ok('ask (Slack path): the context says it is read in Slack', /ASKED FROM SLACK/.test(c));
  ok('ask (Slack path): the meeting search never runs as someone else', s.w.meet.calls.length === 0, s.w.meet.calls);
  const tools1 = (s.llm.seen[0].json.tools || []).map((t) => t.name);
  ok('ask (Slack path): banking is not offered', tools1.indexOf('bank_task') < 0 && tools1.indexOf('create_task') >= 0 && tools1.indexOf('answer_question') >= 0, tools1);
  ok('ask (Slack path): the usage log names the asker', s.llm.seen[0].headers['x-wa-caller'] === 'ask:ann', s.llm.seen[0].headers);
  ok('ask (Slack path): the prompt explains who "my" is', /WHO IS ASKING\. The context opens with who is asking/.test(s.llm.seen[0].json.system));
  ok('ask: the prompt says whose board a new task goes on, and never guesses the Board team', /use the asker's own team from WHO IS ASKING/.test(s.llm.seen[0].json.system) && /never choose the Board team unless they name it/.test(s.llm.seen[0].json.system));

  s.reset();
  r = await s.askDirect({ Authorization: 'Bearer jwt-ann' }, { question: 'What should I focus on this week?' });
  c = s.ctx();
  ok('ask (Hub chat): still answers a signed-in person', r.status === 200 && !!r.json.answer);
  ok('ask (Hub chat): now also told who is asking and their tasks', /WHO IS ASKING: Ann Lee/.test(c) && /THEIR OPEN TASKS \(3 open/.test(c) && !/ASKED FROM SLACK/.test(c));
  ok('ask (Hub chat): the meeting search runs as that person', s.w.meet.calls.length === 1 && s.w.meet.calls[0] === 'user:Bearer jwt-ann', s.w.meet.calls);
  ok('ask (Hub chat): banking is still offered', (s.llm.seen[0].json.tools || []).some((t) => t.name === 'bank_task'));

  /* two people at the same moment: each request keeps its own identity */
  s.reset(); s.w.meet.delay = 40;
  const both = await Promise.all([
    s.askDirect({ Authorization: 'Bearer jwt-jo' }, { question: 'What is on my plate today?' }),
    s.askDirect(Object.assign({}, TRUST, { 'x-wa-as': 'ann@welfareavenue.com' }), { question: 'What is on my plate now?' })
  ]);
  s.w.meet.delay = 0;
  const seenJo = s.llm.seen.filter((x) => /QUESTION: What is on my plate today\?/.test(JSON.stringify(x.json.messages)));
  const seenAnn = s.llm.seen.filter((x) => /QUESTION: What is on my plate now\?/.test(JSON.stringify(x.json.messages)));
  ok('ask (two at once): both are answered', both[0].status === 200 && both[1].status === 200);
  ok('ask (two at once): the meeting search ran once, as the signed-in person only', s.w.meet.calls.length === 1 && s.w.meet.calls[0] === 'user:Bearer jwt-jo', s.w.meet.calls);
  ok('ask (two at once): each context names its own asker', seenJo.length >= 1 && seenAnn.length >= 1 && seenJo.every((x) => /WHO IS ASKING: Joanna Park/.test(JSON.stringify(x.json.messages)) && x.headers['x-wa-caller'] === 'ask:joanna') && seenAnn.every((x) => /WHO IS ASKING: Ann Lee/.test(JSON.stringify(x.json.messages)) && x.headers['x-wa-caller'] === 'ask:ann'));

  s.reset();
  r = await s.askDirect(Object.assign({}, TRUST, { 'x-wa-as': 'ann@welfareavenue.com' }), { question: 'When is Steel stepping down?' });
  ok('ask (Slack path): an off-limits question gets the standard reply and no model call', r.status === 200 && r.json.confidential === true && /not something I can share/.test(r.json.answer) && s.llm.seen.length === 0);

  r = await s.askDirect(Object.assign({}, TRUST, { 'x-wa-as': 'ann@welfareavenue.com' }), { execute: { name: 'create_task', input: { department: 'marketing', title: 'Call the caterer', owner: 'Ann Lee', due_date: '2026-11-20' } } });
  const made = s.db.tables.dept_tasks.find((t) => t.title === 'Call the caterer');
  ok('ask (Slack path): a confirmed task is added, signed with the person and Slack', r.status === 200 && r.json.executed && r.json.executed.ok === true && made && made.owner === 'Ann Lee' && made.updated_by === 'Chat (ann via slack)', [r.json, made]);
  r = await s.askDirect(Object.assign({}, TRUST, { 'x-wa-as': 'ann@welfareavenue.com' }), { execute: { name: 'bank_task', input: { task_id: 1, bank_until: '2027-03-01' } } });
  ok('ask (Slack path): a task cannot be banked without their own sign-in', r.json.executed && /sign in to the Hub/.test(r.json.executed.error || '') && !s.db.tables.dept_tasks.find((t) => t.id === 1).banked_at);

  s.reset();
  r = await s.askDirect({ 'x-wa-secret': 'trigger-secret', Authorization: 'Bearer service-key' }, { question: 'What needs attention today?' });
  ok('ask: the plain trusted path (no person) still works, and says nobody is known', r.status === 200 && /not on the team list/.test(s.ctx()) && s.w.meet.calls.length === 0);
}

/* =================== B. Slack: who gets in =================== */
{
  const s = await stage();
  const getRes = await s.fns.slack.call(new Request('http://fn.test/slack-command', { method: 'GET' }));
  ok('slack: a plain visit says ok and nothing else', getRes.status === 200 && (await getRes.text()) === 'ok');
  let r = await s.post('{"type":"url_verification","challenge":"abc"}', 'application/json', { unsigned: true });
  ok('slack: no signature, refused', r.status === 401);
  r = await s.post('{"type":"url_verification","challenge":"abc"}', 'application/json', { secret: 'someone-else' });
  ok('slack: a signature made with another secret, refused', r.status === 401);
  r = await s.post('{"type":"url_verification","challenge":"abc"}', 'application/json', { ts: String(Math.floor(Date.now() / 1000) - 3600) });
  ok('slack: a request an hour old, refused', r.status === 401);
  r = await s.post('{"type":"url_verification","challenge":"abc123"}', 'application/json');
  ok('slack: Slack\'s address check gets its challenge back', r.status === 200 && r.text === 'abc123');
  r = await s.event({ type: 'message', channel_type: 'im', channel: 'D1', user: 'UANN', text: 'hi', ts: slackTs(1) }, { team_id: 'TOTHER' });
  ok('slack: another workspace, refused', r.status === 403 && s.slackCalls('chat.').length === 0);
  ok('slack: nothing was asked or posted so far', s.askCalls().length === 0 && s.slackCalls('chat.').length === 0);

  const s2 = await stage({ secrets: { SLACK_SIGNING_SECRET: null } });
  r = await s2.slash('UANN', 'tasks');
  ok('slack: without the signing secret, /hub explains and does nothing', r.status === 200 && /not switched on/.test(r.json.text) && s2.askCalls().length === 0);
  r = await s2.post('{"type":"url_verification","challenge":"abc"}', 'application/json');
  ok('slack: without the signing secret, events are refused', r.status === 503);
}

/* =================== C. a direct message =================== */
{
  const s = await stage();
  const Q = 'Which of my tasks are overdue & what is <https://example.org|this>?';
  let r = await s.dm('UANN', Q.replace('&', '&amp;'));
  ok('dm: Slack is answered at once', r.status === 200);
  const posts = s.slackCalls('chat.postMessage'), ups = s.slackCalls('chat.update');
  ok('dm: a "Looking into it" note, then the answer in its place', posts.length === 1 && posts[0].json.text === 'Looking into it...' && posts[0].json.channel === 'D1' && ups.length === 1, [posts.length, ups.length]);
  const a = s.askCalls()[0];
  ok('dm: asked as that person, over the trusted path', a && a.headers['x-wa-as'] === 'ann@welfareavenue.com' && a.headers['x-wa-via'] === 'slack' && a.headers['x-wa-secret'] === 'trigger-secret');
  ok('dm: the question arrives as plain words', a && a.json.question === 'Which of my tasks are overdue & what is this?', a && a.json.question);
  const up = ups[0].json, body = up.blocks.filter((b) => b.type === 'section').map((b) => b.text.text).join('\n');
  ok('dm: bold, bullets and links are written the Slack way', body.indexOf('*one task past its date*') >= 0 && body.indexOf('**') < 0 && body.indexOf('\u2022 Draft the newsletter') >= 0 && body.indexOf('<https://hub.welfareavenue.com/#mypage|Home>') >= 0 && body.indexOf('<https://docs.example.org/d/1?a=1&amp;b=2|the grant doc>') >= 0, body);
  ok('dm: &, < and > in the answer are escaped', body.indexOf('Fish &amp; chips &lt; 5') >= 0);
  ok('dm: the Hub\'s own emoji pass through', body.indexOf(':wa-arrow-go:') >= 0);
  if (process.env.DUMP) console.log('---- the answer as Slack gets it ----\n' + JSON.stringify(up, null, 1));
  ok('dm: the sources sit under the answer', up.blocks.some((b) => b.type === 'context' && /Sources: Marketing meeting, Nov 3/.test(b.elements[0].text)));
  ok('dm: the model was told who is asking', /WHO IS ASKING: Ann Lee/.test(s.ctx()) && /ASKED FROM SLACK/.test(s.ctx()));
  const log = s.db.tables.slack_ask_log;
  ok('dm: one line for the event, one for the question', log.length === 2 && log.some((l) => l.kind === 'seen' && l.event_id) && log.some((l) => l.kind === 'dm' && l.email === 'ann@welfareavenue.com'), log);
  ok('dm: nothing the person typed, and nothing answered, is stored', allText(s.db).indexOf('overdue &') < 0 && allText(s.db).indexOf('Which of my tasks') < 0 && allText(s.db).indexOf('one task past its date') < 0);

  /* the same event again (Slack retries) */
  const before = s.quiet().length;
  const raw = JSON.stringify({ type: 'event_callback', team_id: TEAM, event_id: 'EvSAME', event: { type: 'message', channel_type: 'im', channel: 'D1', user: 'UANN', text: 'hello again', ts: slackTs(1) } });
  await s.post(raw, 'application/json'); const mid = s.quiet().length;
  await s.post(raw, 'application/json');
  ok('dm: a repeat delivery of one event is answered once', mid > before && s.quiet().length === mid);

  s.reset();
  await s.event({ type: 'message', channel_type: 'im', channel: 'D1', user: 'UANN', text: 'x', ts: slackTs(1), bot_id: 'B1' });
  await s.event({ type: 'message', channel_type: 'im', channel: 'D1', user: 'UANN', text: 'x', ts: slackTs(1), subtype: 'message_changed' });
  await s.event({ type: 'message', channel_type: 'channel', channel: 'C1', user: 'UANN', text: 'What is our plan?', ts: slackTs(1) });
  ok('dm: bot messages, edits and channel messages are left alone', s.quiet().length === 0, s.calls.map((c) => c.url));

  s.reset();
  await s.dm('UNOBODY', 'What is my week?');
  ok('dm: an account that matches nobody gets the how-to-link note, and no answer', s.askCalls().length === 0 && s.slackCalls('chat.postMessage').length === 1 && /could not match your Slack account/.test(s.slackCalls('chat.postMessage')[0].json.text));
  s.reset();
  await s.dm('UGONE', 'What is my week?');
  ok('dm: someone no longer active gets no answer', s.askCalls().length === 0 && /could not match/.test(s.slackCalls('chat.postMessage')[0].json.text));
  s.reset(); s.slackState.info.UNEW = { id: 'UNEW', profile: { email: 'NewBie@welfareavenue.com' } };
  await s.dm('UNEW', 'What is my week?');
  ok('dm: someone not in the list yet is matched by the email on their Slack profile', s.askCalls().length === 1 && s.askCalls()[0].headers['x-wa-as'] === 'newbie@welfareavenue.com');
  s.reset(); s.slackState.info.UBOT = { id: 'UBOT', is_bot: true, profile: { email: 'ann@welfareavenue.com' } };
  await s.dm('UBOT', 'What is my week?');
  ok('dm: a bot account is never matched to a person', s.askCalls().length === 0);

  s.reset();
  await s.dm('UANN', 'Tasks');
  const tl = s.slackCalls('chat.postMessage')[0].json.text;
  ok('dm: "tasks" lists their open tasks at once, with no model call', s.askCalls().length === 0 && /Your open tasks \(4\)/.test(tl) && tl.indexOf('Send the partner thank-you notes') >= 0 && tl.indexOf('Count the aprons') >= 0 && /was due/.test(tl), tl);
  ok('dm: that list leaves out other people\'s, confidential, board, restricted, banked and done tasks', ['Plan the reel', 'A private matter', 'Board pack pages', 'Restricted thing', 'Banked thing', 'Done thing', 'Board only thing', 'Unsure whose'].every((t) => tl.indexOf(t) < 0), tl);
  s.reset();
  await s.dm('UANN', 'help');
  ok('dm: "help" says what it can do, by first name', s.askCalls().length === 0 && /^Hi Ann /.test(s.slackCalls('chat.postMessage')[0].json.text) && /nothing is saved until you confirm/.test(s.slackCalls('chat.postMessage')[0].json.text));

  s.reset();
  await s.dm('UANN', 'When is Steel stepping down?');
  const conf = s.slackCalls('chat.update')[0].json;
  ok('dm: an off-limits question gets the standard reply, no sources, no model call', /not something I can share/.test(conf.text) && !conf.blocks.some((b) => b.type === 'context') && s.llm.seen.length === 0);

  /* a follow-up reads the last turns from Slack, recent ones only */
  s.reset();
  s.slackState.history = [
    { ts: slackTs(20), text: 'To confirm: Add a task', bot_id: 'B1' },
    { ts: slackTs(30), text: 'Looking into it...', bot_id: 'B1' },
    { ts: slackTs(40), text: 'You have one task past its date.', bot_id: 'B1' },
    { ts: slackTs(60), text: 'Which of my tasks are overdue?', user: 'UANN' },
    { ts: slackTs(4000), text: 'An old question from this morning', user: 'UANN' }
  ];
  await s.dm('UANN', 'And the second one?');
  const h = s.askCalls()[0].json.history;
  ok('dm: a follow-up carries the recent turns, in order, without notes, cards or old messages', h.length === 2 && h[0].role === 'user' && h[0].content === 'Which of my tasks are overdue?' && h[1].role === 'assistant' && h[1].content === 'You have one task past its date.', h);
  s.slackState.history = [];

  /* a thread (Slack's assistant view) is answered in the thread */
  s.reset();
  await s.dm('UANN', 'What is next?', { thread_ts: '1700000000.000001' });
  ok('dm: a message in a thread is answered in that thread', s.slackCalls('chat.postMessage')[0].json.thread_ts === '1700000000.000001' && s.calls.some((c) => c.url.indexOf(SLACK + '/conversations.replies') === 0));
}

/* =================== D. cards and buttons =================== */
{
  const s = await stage();
  let round = 0;
  s.llm.fn = (body) => {
    round++;
    if (body.tool_choice && body.tool_choice.type === 'tool') return answerCall('Ready for you to check and confirm below :wa-arrow-go:', []);
    if (round === 1) return { content: [{ type: 'tool_use', id: 't1', name: 'create_task', input: { department: 'marketing', title: 'Call the caterer', owner: 'Ann Lee', due_date: '2026-11-20', detail: 'About Sunday' } },
      { type: 'tool_use', id: 't2', name: 'create_request', input: { department: 'marketing', title: 'Poster for the drive', type_key: 'design', details: 'A3, by Friday' } }] };
    return answerCall('Ready for you to check and confirm below :wa-arrow-go:', []);
  };
  await s.dm('UANN', 'Add a task for me: call the caterer by Nov 20, and put in a request to Marketing for a poster for the drive');
  const posts = s.slackCalls('chat.postMessage');
  const cards = posts.filter((p) => (p.json.blocks || []).some((b) => b.type === 'actions'));
  ok('cards: the answer, then one card per action', s.slackCalls('chat.update').length === 1 && cards.length === 2, posts.map((p) => p.json.text));
  const pend = s.db.tables.slack_ask_pending;
  ok('cards: each card waits in the Hub with its content', pend.length === 2 && pend[0].name === 'create_task' && pend[0].input.title === 'Call the caterer' && pend[0].slack_user === 'UANN' && pend[0].email === 'ann@welfareavenue.com' && !pend[0].decided_at);
  const c1 = cards[0].json, btns = c1.blocks.find((b) => b.type === 'actions').elements;
  ok('cards: the card shows what will be saved, and two buttons', /Add a task to Marketing: Call the caterer/.test(c1.blocks[0].text.text) && /Owner: Ann Lee/.test(c1.blocks[0].text.text) && /Due: 2026-11-20/.test(c1.blocks[0].text.text) && btns.length === 2 && btns[0].action_id === 'hub_confirm' && btns[0].value === String(pend[0].id) && btns[1].action_id === 'hub_cancel');
  if (process.env.DUMP) console.log('---- a card as Slack gets it ----\n' + JSON.stringify(c1, null, 1));
  ok('cards: nothing is saved yet', !s.db.tables.dept_tasks.some((t) => t.title === 'Call the caterer') && !s.db.tables.dept_requests.some((t) => t.title === 'Poster for the drive'));

  s.reset();
  await s.click('UJO', 'hub_confirm', String(pend[0].id), 21);
  ok('cards: someone else cannot confirm it', !pend[0].decided_at && s.askCalls().length === 0 && s.hooks().length === 1 && s.hooks()[0].json.replace_original === false && /Only the person who asked/.test(s.hooks()[0].json.text));

  s.reset();
  await s.click('UANN', 'hub_confirm', String(pend[0].id), 22);
  const made = s.db.tables.dept_tasks.find((t) => t.title === 'Call the caterer');
  const ex = s.askCalls()[0];
  ok('cards: Confirm saves it, as that person', !!made && made.owner === 'Ann Lee' && made.due_date === '2026-11-20' && made.updated_by === 'Chat (ann via slack)' && ex.json.execute.name === 'create_task' && ex.headers['x-wa-as'] === 'ann@welfareavenue.com', made);
  ok('cards: the card becomes the result', s.hooks().length === 1 && s.hooks()[0].json.replace_original === true && /:white_check_mark: Added task #\d+ to Marketing: Call the caterer/.test(s.hooks()[0].json.text));
  ok('cards: once decided, the card\'s content is wiped', pend[0].decided_at && pend[0].outcome === 'done' && pend[0].input === null);

  s.reset();
  const n = s.db.tables.dept_tasks.length;
  await s.click('UANN', 'hub_confirm', String(pend[0].id), 23);
  ok('cards: a second press changes nothing', s.db.tables.dept_tasks.length === n && s.askCalls().length === 0 && /Already done/.test(s.hooks()[0].json.text));

  s.reset();
  await s.click('UANN', 'hub_cancel', String(pend[1].id), 24);
  ok('cards: Cancel saves nothing', s.askCalls().length === 0 && pend[1].outcome === 'cancelled' && pend[1].input === null && /Cancelled\. Nothing was saved/.test(s.hooks()[0].json.text) && !s.db.tables.dept_requests.some((t) => t.title === 'Poster for the drive'));

  s.reset();
  s.db.tables.slack_ask_pending.push({ id: '11111111-1111-4111-8111-111111111111', slack_user: 'UANN', email: 'ann@welfareavenue.com', name: 'create_task', input: { department: 'marketing', title: 'Stale one' }, summary: 'Add a task to Marketing: Stale one', created_at: new Date(Date.now() - 25 * 3600 * 1000).toISOString(), decided_at: null });
  await s.click('UANN', 'hub_confirm', '11111111-1111-4111-8111-111111111111', 25);
  ok('cards: a card more than a day old is let go', s.askCalls().length === 0 && /more than a day old/.test(s.hooks()[0].json.text) && !s.db.tables.dept_tasks.some((t) => t.title === 'Stale one'));
  s.reset();
  await s.click('UANN', 'hub_confirm', 'not-a-real-id', 26);
  ok('cards: an unknown card says so', s.askCalls().length === 0 && /no longer here/.test(s.hooks()[0].json.text));

  /* the person left between asking and confirming */
  s.reset();
  s.db.tables.slack_ask_pending.push({ id: '22222222-2222-4222-8222-222222222222', slack_user: 'UJO', email: 'joanna@welfareavenue.com', name: 'create_task', input: { department: 'marketing', title: 'After leaving' }, summary: 'Add a task to Marketing: After leaving', created_at: new Date().toISOString(), decided_at: null });
  s.db.tables.team_members.find((m) => m.id === 2).active = false;
  await s.click('UJO', 'hub_confirm', '22222222-2222-4222-8222-222222222222', 27);
  ok('cards: someone no longer active cannot confirm', s.askCalls().length === 0 && !s.db.tables.dept_tasks.some((t) => t.title === 'After leaving') && /nothing was saved/.test(s.hooks()[0].json.text));
}

/* =================== E. /hub =================== */
{
  const s = await stage();
  let r = await s.slash('UANN', 'tasks');
  ok('/hub tasks: their list, only to them, no model call', r.json.response_type === 'ephemeral' && /Your open tasks \(4\)/.test(r.json.text) && s.askCalls().length === 0);
  r = await s.slash('UANN', '');
  ok('/hub alone: says what it can do', /^Hi Ann /.test(r.json.text) && r.json.response_type === 'ephemeral');
  r = await s.slash('UNOBODY', 'tasks');
  ok('/hub tasks: an account that matches nobody sees no tasks', /could not match your Slack account/.test(r.json.text));
  r = await s.slash('UANN', 'project nothing-like-this');
  ok('/hub project: no match says so', /No project matches/.test(r.json.text));
  r = await s.slash('UANN', 'idea add a print button to the finance page');
  ok('/hub idea: files a change to the Hub', /Filed/.test(r.json.text) && s.db.tables.wa_change_requests.length === 1 && /Ann Lee \(via \/hub\)/.test(s.db.tables.wa_change_requests[0].requested_by));

  s.reset();
  r = await s.slash('UANN', 'what should I focus on this week?', 31);
  ok('/hub <question>: Slack is answered at once, privately', r.json.response_type === 'ephemeral' && r.json.text === 'Looking into it...');
  const hk = s.hooks();
  ok('/hub <question>: the answer replaces the note, only for them', hk.length === 1 && hk[0].url === HOOK + '31' && hk[0].json.response_type === 'ephemeral' && hk[0].json.replace_original === true && /one task past its date/.test(hk[0].json.text));
  ok('/hub <question>: asked as that person, counted once', s.askCalls().length === 1 && s.askCalls()[0].headers['x-wa-as'] === 'ann@welfareavenue.com' && s.db.tables.slack_ask_log.filter((l) => l.kind === 'slash').length === 1);
  ok('/hub <question>: nothing posted to any channel', s.slackCalls('chat.').length === 0);
  s.reset();
  r = await s.slash('UANN', 'request a poster for Sunday from marketing', 32);
  ok('/hub request ...: now goes to Ask the Hub, not to the change list', s.askCalls().length === 1 && s.db.tables.wa_change_requests.length === 1);

  /* the daily limit */
  s.reset();
  for (let i = 0; i < 25; i++) s.db.tables.slack_ask_log.push({ id: 900 + i, email: 'ann@welfareavenue.com', slack_user: 'UANN', kind: i % 2 ? 'dm' : 'slash', at: new Date(Date.now() - 3600 * 1000).toISOString() });
  await s.dm('UANN', 'One more question?');
  ok('limit: after 25 questions in a day, a kind no, and no model call', s.askCalls().length === 0 && /25 questions from Slack in a day/.test(s.slackCalls('chat.postMessage')[0].json.text));
  s.reset();
  await s.dm('UANN', 'tasks');
  ok('limit: the instant list still works', /Your open tasks/.test(s.slackCalls('chat.postMessage')[0].json.text));
  s.reset();
  await s.dm('UJO', 'What is my week?');
  ok('limit: it is each person\'s own', s.askCalls().length === 1);

  /* a mention in a channel */
  s.reset();
  await s.event({ type: 'app_mention', channel: 'C1', user: 'UANN', text: '<@UBOT> what is my week?', ts: slackTs(1) });
  ok('mention: a private note to ask in a direct message, and no answer in the channel', s.askCalls().length === 0 && s.slackCalls('chat.postEphemeral').length === 1 && s.slackCalls('chat.postMessage').length === 0 && s.slackCalls('chat.postEphemeral')[0].json.user === 'UANN');
}

/* =================== F. when the Hub cannot answer =================== */
{
  const s = await stage({ askDown: true });
  await s.dm('UANN', 'What is my week?');
  ok('trouble: the note becomes a plain apology', s.slackCalls('chat.update').length === 1 && /could not get to that just now/.test(s.slackCalls('chat.update')[0].json.text));
  const s2 = await stage({ secrets: { WA_TRIGGER_SECRET: null } });
  await s2.dm('UANN', 'What is my week?');
  ok('trouble: without the trigger secret nothing is asked', s2.askCalls().length === 0 && /could not get to that just now/.test(s2.slackCalls('chat.update')[0].json.text));
  /* with no background hook (a plain runtime), the work still completes before the reply */
  const s3 = await stage({ env: { __NO_EDGE_RUNTIME: '1' } });
  await s3.dm('UANN', 'What is my week?');
  ok('runtime: without a background hook the answer is still sent', s3.slackCalls('chat.update').length === 1);
}

/* =================== H. Slack opens nothing the Hub does not =================== */
{
  const s = await stage();
  /* a roster person whose email is not a Welfare Avenue account cannot use Ask the Hub in the Hub, so not from Slack either */
  let r = await s.askDirect(Object.assign({}, TRUST, { 'x-wa-as': 'friend@example.org' }), { question: 'hello' });
  ok('rule: the trusted path refuses a roster email that is not a Welfare Avenue account', r.status === 401 && s.llm.seen.length === 0);
  s.reset();
  await s.dm('UFRIEND', 'What is my week?');
  ok('rule: in a direct message they get a plain note and no answer', s.askCalls().length === 0 && s.slackCalls('chat.postMessage').length === 1 && /works with a Welfare Avenue account/.test(s.slackCalls('chat.postMessage')[0].json.text), s.slackCalls('chat.postMessage').map((c) => c.json.text));
  s.reset();
  await s.dm('UFRIEND', 'tasks');
  ok('rule: not their task list either', s.slackCalls('chat.postMessage').length === 1 && /works with a Welfare Avenue account/.test(s.slackCalls('chat.postMessage')[0].json.text) && s.slackCalls('chat.postMessage')[0].json.text.indexOf('Friend task') < 0);
  r = await s.slash('UFRIEND', 'tasks');
  ok('rule: /hub tasks, the same note', /works with a Welfare Avenue account/.test(r.json.text) && r.json.text.indexOf('Friend task') < 0);
  r = await s.slash('UFRIEND', 'project community');
  ok('rule: /hub project, the same note, and no project', /works with a Welfare Avenue account/.test(r.json.text) && r.json.text.indexOf('Community Kitchen') < 0);
  r = await s.slash('UNOBODY', 'project community');
  ok('rule: /hub project is not for an account the Hub does not know', /could not match your Slack account/.test(r.json.text) && r.json.text.indexOf('Community Kitchen') < 0);
  r = await s.slash('UANN', 'project community');
  ok('rule: /hub project still answers the team', /Community Kitchen/.test(r.json.text) && /1 open task/.test(r.json.text) && /Order the pots/.test(r.json.text), r.json.text);
  const before = s.db.tables.wa_change_requests.length;
  r = await s.slash('UNOBODY', 'idea add a thing to the home page');
  ok('rule: /hub idea files nothing for an account the Hub does not know', /could not match your Slack account/.test(r.json.text) && s.db.tables.wa_change_requests.length === before);
  s.reset();
  r = await s.slash('UFRIEND', 'what is due this week?', 41);
  ok('rule: /hub and a question, the note arrives in place of an answer', r.json.text === 'Looking into it...' && s.askCalls().length === 0 && s.hooks().length === 1 && /works with a Welfare Avenue account/.test(s.hooks()[0].json.text));
  s.reset();
  s.db.tables.slack_ask_pending.push({ id: '33333333-3333-4333-8333-333333333333', slack_user: 'UFRIEND', email: 'friend@example.org', name: 'create_task', input: { department: 'marketing', title: 'Not for saving' }, summary: 'Add a task', created_at: new Date().toISOString(), decided_at: null, outcome: null });
  await s.click('UFRIEND', 'hub_confirm', '33333333-3333-4333-8333-333333333333', 42);
  ok('rule: a card cannot be confirmed without a Welfare Avenue account', s.askCalls().length === 0 && !s.db.tables.dept_tasks.some((t) => t.title === 'Not for saving') && /nothing was saved/.test(s.hooks()[0].json.text));

  /* the idea command answers Slack first, and the team's ping follows */
  s.reset();
  r = await s.slash('UANN', 'idea add a print button to the finance page');
  ok('/hub idea: filed, and the team is told once', /Filed/.test(r.json.text) && s.calls.filter((c) => c.url === SB + '/functions/v1/notify').length === 1);

  /* Slack's side panel: a new chat opens with four ways to start, for people the Hub knows */
  s.reset();
  await s.event({ type: 'assistant_thread_started', assistant_thread: { user_id: 'UANN', channel_id: 'D1', thread_ts: '1700000000.000002', context: {} } });
  const sp = s.slackCalls('assistant.threads.setSuggestedPrompts');
  ok('side panel: a new chat gets its starters, in that thread', sp.length === 1 && sp[0].json.channel_id === 'D1' && sp[0].json.thread_ts === '1700000000.000002' && Array.isArray(sp[0].json.prompts) && sp[0].json.prompts.length >= 2 && sp[0].json.prompts.length <= 4 && sp[0].json.prompts.every((x) => x.title && x.message) && /Ann/.test(sp[0].json.title), sp.map((c) => c.json));
  ok('side panel: nothing is posted and nothing is asked', s.slackCalls('chat.').length === 0 && s.askCalls().length === 0);
  s.reset();
  await s.event({ type: 'assistant_thread_started', assistant_thread: { user_id: 'UNOBODY', channel_id: 'D2', thread_ts: '1700000000.000003', context: {} } });
  await s.event({ type: 'assistant_thread_started', assistant_thread: { user_id: 'UFRIEND', channel_id: 'D3', thread_ts: '1700000000.000004', context: {} } });
  ok('side panel: no starters for an account the Hub does not answer', s.slackCalls('assistant.').length === 0 && s.slackCalls('chat.').length === 0);
  /* a starter, when pressed, arrives as an ordinary message in that thread */
  s.reset();
  await s.dm('UANN', 'Which requests are waiting on me?', { thread_ts: '1700000000.000002' });
  ok('side panel: a pressed starter is answered in its thread', s.askCalls().length === 1 && s.slackCalls('chat.postMessage')[0].json.thread_ts === '1700000000.000002');

  /* a file with no words gets a plain note; a file with words is answered on its words */
  s.reset();
  await s.dm('UANN', '', { subtype: 'file_share', files: [{ id: 'F1' }] });
  ok('files: a file with no words gets a kind note, and no model call', s.askCalls().length === 0 && s.slackCalls('chat.postMessage').length === 1 && /words only for now/.test(s.slackCalls('chat.postMessage')[0].json.text));
  s.reset();
  await s.dm('UANN', 'What is this week about?', { subtype: 'file_share', files: [{ id: 'F2' }] });
  ok('files: a file with words is answered on its words', s.askCalls().length === 1 && s.askCalls()[0].json.question === 'What is this week about?');
  /* the conversation so far: the last half hour, asked of Slack as a window */
  s.reset();
  await s.dm('UANN', 'And then?', { thread_ts: '1700000000.000009' });
  const rp = s.calls.find((c) => c.url.indexOf(SLACK + '/conversations.replies') === 0);
  const rq = rp ? new URL(rp.url).searchParams : new URLSearchParams();
  ok('history: in a thread, Slack is asked for the last half hour only', !!rp && rq.get('ts') === '1700000000.000009' && Number(rq.get('latest')) - Number(rq.get('oldest')) > 1790 && Number(rq.get('latest')) - Number(rq.get('oldest')) < 1810 && rq.get('inclusive') === 'false', rp && rp.url);

  /* a signing secret pasted with a space or a line break still checks out */
  const s2 = await stage({ secrets: { SLACK_SIGNING_SECRET: ' sign-secret\n' } });
  r = await s2.post('{"type":"url_verification","challenge":"xyz789"}', 'application/json');
  ok('secret: a pasted secret with a stray space or line break still verifies', r.status === 200 && r.text === 'xyz789');
}

/* =================== G. the words =================== */
{
  const src = fs.readFileSync(SLACKFN, 'utf8');
  const strings = (src.match(/'(?:[^'\\\n]|\\.)*'/g) || []).join('\n');
  ok('words: Slack never reads "AI"', !/\bAI\b/.test(strings) && !/\bassistant\b/i.test(strings.replace(/'assistant(\.[A-Za-z.]*)?'/g, '')));
  ok('words: no em or en dashes', !/[\u2014\u2013]/.test(src));
  ok('words: the file is ASCII', !/[^\x00-\x7f]/.test(src));
  ok('words: the Hub\'s address is the real one', src.indexOf('https://hub.welfareavenue.com/') > 0 && src.indexOf('netlify.app') < 0);
}

console.log('\n' + pass + '/' + (pass + fail) + ' passed');
process.exit(fail ? 1 : 0);
