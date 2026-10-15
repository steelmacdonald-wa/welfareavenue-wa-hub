// Welfare Avenue: checkin-post (v8 wave245, 15/10/26: the Still in? DM goes through notify (event loop_still): the person's own
// switch for that kind in the notification centre, the Hub notification on their devices, and the log the centre shows them;
// the direct DM from here is the fallback when notify cannot be reached. Steel: "The notifications need to be even more
// robust and descriptive";
// v7 wave217, 07/10/26: one Still in? Slack DM to the person at 3 hours;
// v6 wave214, 06/10/26: every closed loop posts once, in the check-in-out channel only;
// v5 wave212, 06/10/26: I'm in and Close the loop also post to the check-in-out channel;
// v4 wave192b, 01/10/26: no stored trail, real channel names, private titles never posted;
// v3 wave192, 01/10/26: The Loop; v2 25/09/26: channels + say; v1 25/09/26)
// wave192 (01/10/26), Steel: "I'm questioning whether our checkins should be in our slack channels for everyone to see,
// I really don't want people to feel like they are tracked but more that work that's being done is shared to keep
// everyone in the loop. Also when people check out, it might be helpful to track their clicks in the hub in order to
// help give them a summary of what they did." His choices: the ritual is The Loop (I'm in, Close the loop); starting
// posts nothing; a wrap-up goes to the person's team channel by default, or to everyone (#the-loop) or just the Hub,
// their choice each time; the shared post carries only what moved (no clock time, no hours); the note drafts itself
// from the records the person changed (loop_trail), never from clicks or pages.
// wave212 (06/10/26), Steel: "in and out loops should be sent to the check-in-out channels". I'm in posts a line there
// (and the focus when given); Close the loop posts there too: the note when they shared it (team or everyone), only
// "closed the loop" when they chose just the Hub. Never the clock time or the hours. The channel is app_config
// checkinout_channel (default #check-in-out-wa); a close already posted in that channel is not posted twice.
// wave214 (06/10/26), Steel: "All closed loops should be done in the check in out channel". Asked where a note goes, he
// chose only #check-in-out-wa: no team channel and no Just the Hub. Close the loop posts once, in the check-in-out
// channel: the note with the closed tasks, or the one line "closed the loop" when they close without a note. share_to
// from the page is ignored (a cached older page still sends it). Never the clock time or the hours.
// wave217 (07/10/26), Steel: "After an hour, hour and a half, 2 hours, and 2.5 hours being in, I want you to do a light
// check to confirm if they are still in." The checks are in the Hub (118b); his choice for Slack: "slack sent to their own
// dm after 3 hours". still_dm (trigger secret only; the cron wa-loop-still-dm calls it through wa217_loop_dm_tick when
// wa217_loop_dm_due() has a session) claims each due session (loop_dm_at), then DMs the person from the Hub bot with two
// links: Still in (?loop=still) and Close the loop (?loop=close). Once per session; nothing happens when nobody answers.
// The DM names their own time to them only; nothing is posted in a channel. dry: true lists what it would send, and
// checkin_id with dry previews one session's message; neither claims nor sends.
// wave165 (29/09/26): the tasks a check-out offers to close are the person's own and their team's open ones (one-on-ones
// are only for the people speaking in them now: visibility speakers; restricted work never reaches someone else's check-out).
// wave132 (26/09/26): leaves out what is in the bank (tasks and projects parked for three months or more carry banked_at).
//
// Actions (staff sign-in; the build can act as a person with the trigger secret and as_email):
//   The Loop (wave192, the page since wave192):
//   start     {checkin_id, focus?}          -> keeps the focus on the row; posts "is in the loop" in the check-in-out channel
//   draft     {checkin_id}                  -> the trail since the session started, drafted as bullets, the hidden count,
//                                              the open tasks worth closing, the channel the note goes to
//                                              (everyone_channel: the check-in-out channel; team_channel is null since
//                                              wave214); nothing is written or kept
//   tidy      {checkin_id?, bullets[], text} -> the model folds what they said into the draft (their facts only) and names
//                                              the open tasks their words show are finished
//   close     {checkin_id, bullets[], close_task_ids[], skipped?, dry?}   (share_to is ignored since wave214)
//             -> closes the ticked tasks, saves the note, posts it once in the check-in-out channel (without a note, the
//                one line "closed the loop"); dry: true answers with the post it would make and changes nothing. A private task (confidential,
//                board-only, or not team-visible) closes like any other but is never named in a post ("1 private task").
//   Privacy (wave192b): the trail is built on demand for the person's own sheet and never stored; the shared post carries
//   what moved, never the clock time or the hours.
//   Before wave192 (the page until wave192 ships; kept so the live page keeps working, minus times and hours):
//   in        {checkin_id, focus?}          -> posts the check-in line (no clock time since wave192)
//   summarise {text}                        -> bullets + tasks worth closing, from the person's own words
//   out       {checkin_id, bullets[], close_task_ids[], skipped?} -> closes the ticked tasks, saves the summary, posts the
//                                              check-out line (no duration since wave192)
//   still_dm  {dry?, checkin_id?}           -> (trigger secret only) the one Still in? DM at 3 hours, see wave217 above
//   channels  {}                            -> the channels the bot can see (name, id, member)
//   say       {channel, text}               -> post text to a named channel as the bot (joins a public one)
// The model call goes through the Hub router (task 'checkin'); Slack goes through the bot (chat.postMessage).
// Tables: hub_checkins (read, update), dept_tasks (read; done on close), change_log (insert), team_members, wa_slack_ids,
// app_config (checkinout_channel; loop_channel as the fallback), dept_meta; loop_trail() for the draft;
// wa217_loop_dm_due() and hub_checkins.loop_dm_at for the 3-hour DM.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const OLD_CHANNEL = 'check-in-out-wa';
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}
type Me = { email: string; name: string };
async function caller(req: Request): Promise<Me | null> {
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  if (!email) return null;
  if (!(email.endsWith('@welfareavenue.com') || email === 'steelmacdonald@gmail.com')) return null;
  const meta = (data?.user?.user_metadata || {}) as Record<string, string>;
  return { email, name: meta.full_name || meta.name || email.split('@')[0] };
}
type Member = { id: number; name: string; department: string | null };
async function member(email: string): Promise<Member | null> {
  const { data } = await svc.from('team_members').select('id, name, department').ilike('email', email).maybeSingle();
  return (data as Member | null) || null;
}

/* ---- Slack ---- */
type Chan = { id: string; name: string; member: boolean; priv: boolean };
let CHANS: Chan[] | null = null;
async function slack(tok: string, method: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch('https://slack.com/api/' + method, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) });
  return await res.json();
}
async function channels(tok: string): Promise<Chan[]> {
  if (CHANS) return CHANS;
  const out: Chan[] = [];
  let cursor = '';
  for (let i = 0; i < 10; i++) {
    const res = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=true&limit=200' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''), { headers: { Authorization: 'Bearer ' + tok } });
    const b = await res.json();
    // deno-lint-ignore no-explicit-any
    for (const c of ((b.channels || []) as any[])) out.push({ id: String(c.id), name: String(c.name), member: !!c.is_member, priv: !!c.is_private });
    cursor = b.response_metadata?.next_cursor || ''; if (!cursor) break;
  }
  CHANS = out;
  return out;
}
/* the channel by name; joins a public one the bot is not in yet */
async function channelByName(tok: string, name: string): Promise<Chan | null> {
  const want = String(name || '').replace(/^#/, '').trim();
  if (!want) return null;
  const hit = (await channels(tok)).find(c => c.name === want || c.id === want) || null;
  if (hit && !hit.member) { try { const j = await slack(tok, 'conversations.join', { channel: hit.id }); if (j.ok) hit.member = true; } catch (_) { /* private: someone adds the bot */ } }
  return hit;
}
/* the check-in-out channel (wave212): app_config checkinout_channel, default #check-in-out-wa; every closed loop goes here (wave214) */
async function checkinoutChannel(tok: string): Promise<Chan | null> {
  let want = OLD_CHANNEL;
  try { const { data } = await svc.from('app_config').select('value').eq('key', 'checkinout_channel').maybeSingle(); const v = String((data as { value?: string } | null)?.value || '').replace(/^#/, '').trim(); if (v) want = v; } catch (_) { /* default */ }
  return await channelByName(tok, want);
}
async function loopChannelName(): Promise<string> {
  try { const { data } = await svc.from('app_config').select('value').eq('key', 'loop_channel').maybeSingle(); const v = String((data as { value?: string } | null)?.value || '').replace(/^#/, '').trim(); if (v) return v; } catch (_) { /* default */ }
  return 'the-loop';
}
/* the Loop channel (everyone): app_config loop_channel, else the old #check-in-out-wa until Steel renames it */
async function everyoneChannel(tok: string): Promise<Chan | null> {
  const want = await loopChannelName();
  return (await channelByName(tok, want)) || (want !== OLD_CHANNEL ? await channelByName(tok, OLD_CHANNEL) : null);
}
async function slackUserId(email: string): Promise<string | null> {
  try { const { data } = await svc.from('wa_slack_ids').select('slack_id').ilike('email', email).maybeSingle(); return (data as { slack_id?: string } | null)?.slack_id || null; } catch (_) { return null; }
}
async function postTo(tok: string, ch: Chan, text: string): Promise<{ ts: string | null; error: string | null }> {
  try {
    const out = await slack(tok, 'chat.postMessage', { channel: ch.id, text, unfurl_links: false, unfurl_media: false });
    if (!out.ok) return { ts: null, error: String(out.error || 'slack refused') };
    return { ts: String(out.ts || ''), error: null };
  } catch (e) { return { ts: null, error: String((e as Error).message || e).slice(0, 200) }; }
}
/* the old page's posts (before wave192): the old channel, through the same bot */
async function postOld(text: string): Promise<{ ts: string | null; error: string | null }> {
  try {
    const tok = await getSecret('SLACK_BOT_TOKEN');
    const ch = (await channelByName(tok, OLD_CHANNEL)) || (await everyoneChannel(tok));
    if (!ch) return { ts: null, error: 'channel #' + OLD_CHANNEL + ' not found' };
    return await postTo(tok, ch, text);
  } catch (e) { return { ts: null, error: String((e as Error).message || e).slice(0, 200) }; }
}
function mention(name: string, sid: string | null): string { return sid ? '<@' + sid + '>' : '*' + name + '*'; }
async function teamLabel(dept: string | null): Promise<string> {
  if (!dept) return '';
  try { const { data } = await svc.from('dept_meta').select('label, short_label').eq('department', dept).maybeSingle(); const d = data as { label?: string; short_label?: string } | null; return (d && (d.short_label || d.label)) || ''; } catch (_) { return ''; }
}

/* ---- the open tasks a wrap-up may close ---- */
type Task = { id: number; title: string; owner: string | null; department: string | null; subsection: string | null; due_date: string | null; project_id: number | null };
async function myTasks(m: Member | null, fallbackName: string): Promise<Task[]> {
  const name = (m ? m.name : fallbackName) || '';
  const first = name.split(' ')[0];
  if (!first) return [];
  const { data } = await svc.from('dept_tasks').select('id, title, owner, department, subsection, due_date, project_id, visibility').is('banked_at', null).eq('done', false).or('owner.ilike.%' + first.replace(/[%,]/g, '') + '%' + (m && m.department ? ',department.eq.' + m.department : '')).order('updated_at', { ascending: false }).limit(60);
  /* wave165: another person's restricted task (leadership, confidential, a one-on-one's) never shows; the person's own always does */
  const rows = ((data || []) as Array<Task & { visibility?: string | null }>).filter(t => !t.visibility || t.visibility === 'department' || (t.owner || '').toLowerCase().includes(first.toLowerCase()));
  const own = rows.filter(t => (t.owner || '').toLowerCase().includes(first.toLowerCase()));
  const team = rows.filter(t => !own.includes(t));
  return own.concat(team).slice(0, 40);
}

/* ---- the draft from the trail (wave192): deterministic, their records only ---- */
type Item = { k: string; t: string; id: string; at: string };
function joinTitles(items: Item[], max: number): string {
  const seen = new Set<string>(); const titles: string[] = [];
  for (const it of items) { const t = String(it.t || '').trim(); if (!t || seen.has(t.toLowerCase())) continue; seen.add(t.toLowerCase()); titles.push(t.length > 70 ? t.slice(0, 67) + '…' : t); }
  const shown = titles.slice(0, max);
  return shown.join('; ') + (titles.length > max ? ' and ' + (titles.length - max) + ' more' : '');
}
function draftBullets(items: Item[]): string[] {
  const by: Record<string, Item[]> = {};
  for (const it of items) (by[it.k] = by[it.k] || []).push(it);
  const mentioned = new Set<string>();
  const out: string[] = [];
  const take = (k: string) => (by[k] || []).filter(it => !mentioned.has(k.startsWith('task') ? 'task:' + it.id : k + ':' + it.id));
  const mark = (k: string, list: Item[]) => list.forEach(it => mentioned.add(k.startsWith('task') ? 'task:' + it.id : k + ':' + it.id));
  const push = (s: string) => { if (s && out.length < 8) out.push(s.length > 180 ? s.slice(0, 177) + '…' : s); };
  let l: Item[];
  if ((l = take('task_done')).length) { push('Closed: ' + joinTitles(l, 4)); mark('task_done', l); }
  if ((l = take('task_new')).length) { push('Opened: ' + joinTitles(l, 3)); mark('task_new', l); }
  if ((l = take('task_note')).length) { push('Commented on: ' + joinTitles(l, 3)); mark('task_note', l); }
  if ((l = take('task_edit')).length) { push('Updated: ' + joinTitles(l, 3)); mark('task_edit', l); }
  if ((l = take('request_new')).length) { push('Asked for: ' + joinTitles(l, 2)); }
  if ((l = take('request_done')).length) { push('Handled: ' + joinTitles(l, 2)); }
  if ((l = take('request_note')).length) { push('Added a note on: ' + joinTitles(l, 2)); }
  if ((l = take('meeting')).length) { push('Joined: ' + joinTitles(l, 3)); }
  if ((l = take('learned')).length) { push('Finished in the Academy: ' + joinTitles(l, 3)); }
  if ((l = take('onboarding')).length) { push('Onboarding: ' + l.length + (l.length === 1 ? ' step done' : ' steps done') + ' (' + joinTitles(l, 2) + ')'); }
  if ((l = take('goal')).length) { push('Updated goal: ' + joinTitles(l, 2)); }
  if ((l = take('goal_note')).length) { push('Commented on goal: ' + joinTitles(l, 2)); }
  if ((l = take('decision')).length) { push('Moved a decision: ' + joinTitles(l, 2)); }
  if ((l = take('update')).length) { push('Posted a team update: ' + joinTitles(l, 1)); }
  if ((l = take('transcript')).length) { push('Added a transcript: ' + joinTitles(l, 2)); }
  if ((l = take('announce')).length) { push('Posted an announcement: ' + joinTitles(l, 2)); }
  if ((l = take('post')).length) { push('Worked on a post: ' + joinTitles(l, 2)); }
  if ((l = take('mention')).length) { push('Brought in ' + joinTitles(l, 2)); }
  if ((l = take('roster')).length) { push("Updated a serving's roster" + (l.length > 1 ? ' (' + l.length + ' changes)' : '')); }
  if ((l = take('mail')).length) { push('Handled ' + l.length + (l.length === 1 ? ' team email' : ' team emails')); }
  if ((l = take('crm')).length) { push('Updated ' + l.length + (l.length === 1 ? ' contact' : ' contacts') + ' in the CRM'); }
  return out;
}
async function trail(email: string, since: string, until: string): Promise<{ items: Item[]; hidden: number; department: string | null; name: string }> {
  const { data, error } = await svc.rpc('loop_trail', { p_email: email, p_since: since, p_until: until });
  if (error) throw new Error('the trail did not load (' + error.message + ')');
  const d = (data || {}) as { items?: Item[]; hidden?: number; department?: string | null; name?: string };
  return { items: Array.isArray(d.items) ? d.items : [], hidden: Number(d.hidden || 0), department: d.department || null, name: d.name || '' };
}

/* ---- the model: folds what they said into the note ---- */
const TOOL = {
  name: 'checkout_summary',
  description: 'Turn what the person said, and what the Hub already drafted, into a short wrap-up note.',
  input_schema: {
    type: 'object',
    properties: {
      bullets: { type: 'array', items: { type: 'string' }, description: '2 to 8 bullet points, each under 18 words, past tense, first person implied (no "I"), concrete. Keep every fact of the Hub draft and of their words; merge duplicates; add nothing.' },
      close: { type: 'array', items: { type: 'object', properties: { task_id: { type: 'integer' }, why: { type: 'string', description: 'The words of theirs that show it is finished, under 15 words' } }, required: ['task_id', 'why'] }, description: 'Open tasks their words show are finished. Only ids from the list. Progress or "almost" is not finished.' },
    },
    required: ['bullets', 'close'],
  },
};
async function tidy(text: string, draft: string[], m: Member | null, fallbackName: string): Promise<{ bullets: string[]; suggest: Array<{ id: number; title: string; why: string }>; tasks: Task[] }> {
  const tasks = await myTasks(m, fallbackName);
  const list = tasks.map(t => t.id + ': ' + t.title + (t.owner ? ' (owner ' + t.owner + ')' : '')).join('\n') || 'none';
  const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
    method: 'POST', headers: { Authorization: 'Bearer ' + SERVICE_KEY, 'x-wa-task': 'checkin', 'x-wa-caller': 'checkin-post', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      max_tokens: 800, temperature: 0.2,
      system: 'You tidy a Welfare Avenue team member’s wrap-up note for their teammates. Plain words, their facts only, no em dashes, no praise, no filler, no times or hours. The Hub already drafted lines from their records: keep those facts (reword only to merge or shorten), then fold in what they said. Spoken text may have transcription slips: fix obvious ones, never invent.',
      messages: [{ role: 'user', content: 'PERSON: ' + (m ? m.name : fallbackName) + (m && m.department ? ' (' + m.department + ')' : '') + '\n\nTHEIR OPEN TASKS (id: title):\n' + list + '\n\nTHE HUB’S DRAFT:\n' + (draft.length ? draft.map(b => '- ' + b).join('\n') : '(nothing)') + '\n\nWHAT THEY SAID:\n' + (text || '(nothing)').slice(0, 6000) }],
      tools: [TOOL], tool_choice: { type: 'tool', name: 'checkout_summary' },
    }),
  });
  if (!res.ok) throw new Error('the model did not answer (' + res.status + ')');
  const body = await res.json();
  // deno-lint-ignore no-explicit-any
  const tu = (body.content || []).find((c: any) => c.type === 'tool_use');
  const input = (tu && tu.input) || {};
  const bullets = (Array.isArray(input.bullets) ? input.bullets : []).map((b: unknown) => String(b).replace(/—/g, ',').replace(/^[•\-\*]\s*/, '').trim()).filter(Boolean).slice(0, 8);
  const ids = new Set(tasks.map(t => t.id));
  const suggest = (Array.isArray(input.close) ? input.close : []).filter((c: { task_id?: unknown }) => ids.has(Number(c.task_id))).map((c: { task_id: number; why?: string }) => { const t = tasks.find(x => x.id === Number(c.task_id))!; return { id: t.id, title: t.title, why: String(c.why || '').slice(0, 120) }; }).slice(0, 6);
  return { bullets: bullets.length ? bullets : draft.concat(text.trim() ? [text.trim().slice(0, 200)] : []), suggest, tasks };
}

/* ---- closing tasks (shared by out and close) ---- */
type Closed = { id: number; title: string; priv: boolean };
function isPrivate(t: { confidential?: boolean | null; board_only?: boolean | null; visibility?: string | null }): boolean {
  return !!t.confidential || !!t.board_only || (!!t.visibility && t.visibility !== 'department');
}
async function closeTasks(ids: number[], by: string, dry = false): Promise<Closed[]> {
  const closed: Closed[] = [];
  for (const tid of ids) {
    const { data: t } = await svc.from('dept_tasks').select('id, title, done, confidential, board_only, visibility').eq('id', tid).maybeSingle();
    if (!t || t.done) continue;
    if (!dry) {
      const now = new Date().toISOString();
      const up = await svc.from('dept_tasks').update({ done: true, closed_at: now, updated_at: now, updated_by: by }).eq('id', tid);
      if (up.error) continue;
      try { await svc.from('change_log').insert({ entity_type: 'task', entity_id: String(tid), field: 'done', old_value: 'false', new_value: 'true (closed at check-out)', changed_by: by }); } catch (_) { /* audit */ }
    }
    closed.push({ id: Number(t.id), title: String(t.title), priv: isPrivate(t) });
  }
  return closed;
}
/* the Closed line of a post: open titles by name, private ones only counted */
function closedLine(list: Closed[]): string {
  if (!list.length) return '';
  const named = list.filter(c => !c.priv).map(c => cut(c.title, 70));
  const priv = list.filter(c => c.priv).length;
  const parts = named.slice();
  if (priv) parts.push(priv + (priv === 1 ? ' private task' : ' private tasks'));
  return '\n:white_check_mark: Closed: ' + parts.join(', ');
}
function cut(s: string, n: number): string { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

/* ---- wave217: the one Still in? DM at 3 hours ---- */
const HUB = 'https://hub.welfareavenue.com/';
function inFor(mins: number): string {
  const half = Math.max(6, Math.floor(mins / 30));   /* whole half hours, 3 hours at least */
  const h = Math.floor(half / 2);
  return h + (half % 2 ? ' and a half' : '') + ' hours';
}
function stillText(name: string, startedAt: string): string {
  const first = String(name || '').trim().split(/\s+/)[0] || 'there';
  const mins = (Date.now() - new Date(startedAt).getTime()) / 60000;
  return 'Hi ' + first + ', you have been in the loop for ' + inFor(mins) + '. Still going? Tap Still in. All done? Close the loop and share what moved.\n'
    + '<' + HUB + '?loop=still|Still in>   \u00b7   <' + HUB + '?loop=close|Close the loop>\n'
    + '_Only you get this message. Nothing changes if you leave it._';
}
/* v8 (wave245): the DM through notify: the person's switch for the kind, the Hub notification, the centre's log. null when
   notify cannot be reached (the caller then DMs directly). */
const WORDS: Record<string, string> = { sent: 'sent', sent_channel: 'sent (channel ping)', opted_out: 'not sent: switched off in the notification centre', hub_only: 'not sent: Hub notifications only (their choice)', no_slack: 'not sent: no Slack account linked', no_email: 'not sent: not on the roster', failed: 'not sent: Slack refused' };
async function viaNotify(secret: string, event: string, to: string[], text: string, title: string, body: string, url: string, tag: string): Promise<{ slack: string; hub: string } | null> {
  try {
    const r = await fetch(SUPABASE_URL + '/functions/v1/notify', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-wa-secret': secret, Authorization: 'Bearer ' + ANON_KEY }, body: JSON.stringify({ event, to, text, title, body, url, tag }) });
    if (!r.ok) return null;
    const j = await r.json().catch(() => ({}));
    if (!j || !j.outcome || typeof j.outcome !== 'object') return null;
    const code = String((j.outcome as Record<string, string>)[to[0]] || 'failed');
    return { slack: WORDS[code] || code, hub: String(j.hub || 'off') };
  } catch (_) { return null; }
}
type Due = { id: number; email: string; name: string | null; started_at: string };
async function stillDm(dry: boolean, onlyId: number): Promise<Record<string, unknown>> {
  let due: Due[] = [];
  if (onlyId && dry) {
    const { data } = await svc.from('hub_checkins').select('id, email, name, started_at').eq('id', onlyId).maybeSingle();
    if (data) due = [data as Due];
  } else {
    const { data, error } = await svc.rpc('wa217_loop_dm_due');
    if (error) throw new Error('the due list did not load (' + error.message + ')');
    due = (data || []) as Due[];
  }
  const out: Array<Record<string, unknown>> = [];
  let tok = '';
  for (const d of due) {
    const email = String(d.email || '').toLowerCase();
    const m = await member(email);
    const name = (m && m.name) || d.name || email.split('@')[0];
    const sid = await slackUserId(email);
    const text = stillText(name, d.started_at);
    if (dry) { out.push({ id: d.id, email, slack: !!sid, text }); continue; }
    /* claim it first: a session gets at most one DM, sent or not */
    const claim = await svc.from('hub_checkins').update({ loop_dm_at: new Date().toISOString() }).eq('id', d.id).is('loop_dm_at', null).is('ended_at', null).select('id');
    if (claim.error || !claim.data || !claim.data.length) continue;
    let result = 'sent';
    let hub = 'off';
    /* v8: through notify (the switch, the Hub notification, the centre's log); directly only when notify cannot be reached */
    let secret = '';
    try { secret = await getSecret('WA_TRIGGER_SECRET'); } catch (_) { secret = ''; }
    const via = secret ? await viaNotify(secret, 'loop_still', [email], text, 'Still in the Loop?', 'You have been in the loop for ' + inFor((Date.now() - new Date(d.started_at).getTime()) / 60000) + '. Still going, or all done? Open the Hub for Still in or Close the loop.', '#mypage', 'loop-still-' + d.id) : null;
    if (via) { result = via.slack; hub = via.hub; }
    else if (!sid) result = 'not sent: no Slack account linked';
    else {
      try {
        if (!tok) tok = await getSecret('SLACK_BOT_TOKEN');
        const im = await slack(tok, 'conversations.open', { users: sid });
        // deno-lint-ignore no-explicit-any
        const ch = String(((im.channel || {}) as any).id || '');
        if (!im.ok || !ch) result = 'not sent: ' + String(im.error || 'no DM channel');
        else {
          const r = await slack(tok, 'chat.postMessage', { channel: ch, text, unfurl_links: false, unfurl_media: false });
          if (!r.ok) result = 'not sent: ' + String(r.error || 'slack refused');
        }
      } catch (e) { result = 'not sent: ' + String((e as Error).message || e).slice(0, 160); }
      result += ' (directly: notify unreachable)';
    }
    /* the audit line names the check, never the hours */
    try { await svc.from('change_log').insert({ entity_type: 'checkin', entity_id: email, field: 'still_dm', old_value: null, new_value: 'Still in? Slack DM ' + result + (via ? '; Hub: ' + hub : ''), changed_by: 'The Loop' }); } catch (_) { /* audit */ }
    out.push({ id: d.id, email, result, hub });
  }
  return { ok: true, dry, due: due.length, done: out };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const body = await req.json().catch(() => ({}));
  /* wave217: the 3-hour DM, for the cron (the trigger secret, never a person) */
  if (body.action === 'still_dm') {
    let okSecret = false;
    try { const g = req.headers.get('x-wa-secret'); okSecret = !!g && g === (await getSecret('WA_TRIGGER_SECRET')); } catch (_) { /* no */ }
    if (!okSecret) return json({ error: 'unauthorized' }, 401);
    try { return json(await stillDm(body.dry === true, Number(body.checkin_id) || 0)); } catch (e) { return json({ error: String((e as Error).message || e).slice(0, 300) }, 500); }
  }
  let me = await caller(req);
  if (!me && typeof body.as_email === 'string') {
    /* the build can act as a person with the trigger secret (tests) */
    try { const g = req.headers.get('x-wa-secret'); if (g && g === (await getSecret('WA_TRIGGER_SECRET'))) me = { email: String(body.as_email).toLowerCase(), name: String(body.as_name || body.as_email) }; } catch (_) { /* no */ }
  }
  if (!me) return json({ error: 'unauthorized' }, 401);
  const action = String(body.action || '');
  const m = await member(me.email);
  const name = (m && m.name) || me.name;
  try {
    /* ---------------- The Loop (wave192) ---------------- */
    if (action === 'start') {
      const id = Number(body.checkin_id);
      const { data: row } = await svc.from('hub_checkins').select('id, email').eq('id', id).maybeSingle();
      if (!row || String(row.email).toLowerCase() !== me.email) return json({ error: 'session not found' }, 404);
      const focus = typeof body.focus === 'string' ? body.focus.trim().slice(0, 300) : '';
      if (focus) await svc.from('hub_checkins').update({ focus }).eq('id', id);
      /* wave212: a line in the check-in-out channel (no clock time) */
      let r: { ts: string | null; error: string | null } = { ts: null, error: 'no channel' };
      try {
        const tok = await getSecret('SLACK_BOT_TOKEN');
        const ch = await checkinoutChannel(tok);
        if (ch) r = await postTo(tok, ch, ':large_green_circle: ' + mention(name, await slackUserId(me.email)) + ' is in the loop' + (focus ? '\n_Today:_ ' + focus : ''));
        if (r.ts) await svc.from('hub_checkins').update({ slack_ts: r.ts }).eq('id', id);
      } catch (e) { r = { ts: null, error: String((e as Error).message || e).slice(0, 200) }; }
      return json({ ok: true, posted: !!r.ts, error: r.ts ? null : r.error });
    }
    if (action === 'draft') {
      const id = Number(body.checkin_id);
      const { data: row } = await svc.from('hub_checkins').select('id, started_at, ended_at, email').eq('id', id).maybeSingle();
      if (!row || String(row.email).toLowerCase() !== me.email) return json({ error: 'session not found' }, 404);
      const until = row.ended_at || new Date().toISOString();
      const tr = await trail(me.email, row.started_at, until);
      const bullets = draftBullets(tr.items);
      const tasks = await myTasks(m, name);
      const mins = Math.max(1, Math.round((new Date(until).getTime() - new Date(row.started_at).getTime()) / 60000));
      /* where the note goes (wave214): the check-in-out channel, for everyone; no team channel */
      let allCh: string | null = null;
      try { const tok = await getSecret('SLACK_BOT_TOKEN'); const ec = (await checkinoutChannel(tok)) || (await everyoneChannel(tok)); allCh = ec ? ec.name : null; } catch (_) { /* the sheet falls back to the name it knows */ }
      return json({ ok: true, bullets, items: tr.items.length, hidden: tr.hidden, minutes: mins, open_tasks: tasks.slice(0, 20).map(t => ({ id: t.id, title: t.title, owner: t.owner })), department: m ? m.department : null, team: await teamLabel(m ? m.department : null), team_channel: null, everyone_channel: allCh });
    }
    if (action === 'tidy') {
      const text = String(body.text || '').trim();
      const draft = (Array.isArray(body.bullets) ? body.bullets : []).map((b: unknown) => String(b).trim()).filter(Boolean).slice(0, 10);
      if (text.length < 3 && !draft.length) return json({ error: 'Say or type what you got done first.' }, 400);
      const out = await tidy(text, draft, m, name);
      return json({ ok: true, bullets: out.bullets, suggest: out.suggest, open_tasks: out.tasks.slice(0, 20).map(t => ({ id: t.id, title: t.title, owner: t.owner })) });
    }
    if (action === 'close') {
      const id = Number(body.checkin_id);
      const { data: row } = await svc.from('hub_checkins').select('id, started_at, ended_at, minutes, email').eq('id', id).maybeSingle();
      if (!row || String(row.email).toLowerCase() !== me.email) return json({ error: 'session not found' }, 404);
      const dry = body.dry === true;
      const given: string[] = (Array.isArray(body.bullets) ? body.bullets : []).map((b: unknown) => String(b).trim()).filter(Boolean).slice(0, 8);
      const closeIds: number[] = (Array.isArray(body.close_task_ids) ? body.close_task_ids : []).map(Number).filter((n: number) => n > 0).slice(0, 10);
      const skipped = body.skipped === true || !given.length;
      const bullets: string[] = skipped ? [] : given;
      /* wave214: every closed loop goes to the check-in-out channel, once; share_to from the page is ignored.
         share_to is kept on the row: everyone for a note, hub for a close without one (the one line only) */
      const shareTo = skipped ? 'hub' : 'everyone';
      const endIso = row.ended_at || new Date().toISOString();
      const mins = row.minutes || Math.max(1, Math.round((new Date(endIso).getTime() - new Date(row.started_at).getTime()) / 60000));
      /* where it goes: the check-in-out channel (the Loop channel only if that one cannot be found) */
      let ch: Chan | null = null; let tok = '';
      try { tok = await getSecret('SLACK_BOT_TOKEN'); ch = (await checkinoutChannel(tok)) || (await everyoneChannel(tok)); } catch (_) { /* reported below */ }
      /* one channel for every team, so the post says which team */
      const label = await teamLabel(m ? m.department : null);
      /* the post: what moved, never the clock or the hours */
      const closed = await closeTasks(closeIds, name, dry);
      let text = ':repeat: *' + name + '*' + (label ? ' (' + label + ')' : '') + ' closed the loop';
      if (bullets.length) text += '\n' + bullets.map(b => '• ' + b).join('\n');
      text += closedLine(closed);
      if (dry) return json({ ok: true, dry: true, share_to: shareTo, channel: ch ? ch.name : null, text, minutes: mins });
      if (!row.ended_at) await svc.from('hub_checkins').update({ ended_at: endIso, minutes: mins }).eq('id', id);
      let r: { ts: string | null; error: string | null } = { ts: null, error: null };
      if (!ch || !tok) r = { ts: null, error: 'no channel the Hub can post in' };
      else r = await postTo(tok, ch, text);
      await svc.from('hub_checkins').update({
        slack_out_ts: r.ts, share_to: shareTo, share_channel: r.ts && ch ? ch.name : null,
        summary: bullets.length ? { bullets, closed: closeIds, skipped: false, share_to: shareTo } : null,
        closed_task_ids: closeIds.length ? closeIds : null,
      }).eq('id', id);
      try { await svc.from('change_log').insert({ entity_type: 'checkin', entity_id: me.email, field: 'loop', old_value: null, new_value: 'closed the loop' + (bullets.length ? ' with a note' : ' without a note') + (r.ts && ch ? ' (#' + ch.name + ')' : ' (not posted: ' + (r.error || 'unknown') + ')'), changed_by: name }); } catch (_) { /* audit */ }
      return json({ ok: true, posted: !!r.ts, error: r.error, channel: r.ts && ch ? ch.name : null, checkinout: !!r.ts, share_to: shareTo, closed: closed.map(c => c.title), closed_ids: closed.map(c => c.id), minutes: mins });
    }

    /* ---------------- before wave192: the page until the Loop ships ---------------- */
    if (action === 'in') {
      const id = Number(body.checkin_id);
      const { data: row } = await svc.from('hub_checkins').select('id, started_at, email').eq('id', id).maybeSingle();
      if (!row || String(row.email).toLowerCase() !== me.email) return json({ error: 'check-in not found' }, 404);
      const focus = typeof body.focus === 'string' ? body.focus.trim().slice(0, 300) : '';
      const sid = await slackUserId(me.email);
      /* wave192: no clock time in the post */
      const text = ':large_green_circle: ' + mention(name, sid) + ' checked in' + (focus ? '\n_Today:_ ' + focus : '');
      const r = await postOld(text);
      await svc.from('hub_checkins').update({ slack_ts: r.ts, focus: focus || null }).eq('id', id);
      return json({ ok: true, posted: !!r.ts, error: r.error });
    }
    if (action === 'summarise') {
      const text = String(body.text || '').trim();
      if (text.length < 3) return json({ error: 'Say or type what you got done first.' }, 400);
      const out = await tidy(text, [], m, name);
      return json({ ok: true, bullets: out.bullets, suggest: out.suggest, open_tasks: out.tasks.slice(0, 20).map(t => ({ id: t.id, title: t.title, owner: t.owner })) });
    }
    if (action === 'out') {
      const id = Number(body.checkin_id);
      const { data: row } = await svc.from('hub_checkins').select('id, started_at, ended_at, minutes, email').eq('id', id).maybeSingle();
      if (!row || String(row.email).toLowerCase() !== me.email) return json({ error: 'check-in not found' }, 404);
      const bullets: string[] = (Array.isArray(body.bullets) ? body.bullets : []).map((b: unknown) => String(b).trim()).filter(Boolean).slice(0, 8);
      const closeIds: number[] = (Array.isArray(body.close_task_ids) ? body.close_task_ids : []).map(Number).filter((n: number) => n > 0).slice(0, 10);
      const endIso = row.ended_at || new Date().toISOString();
      const mins = row.minutes || Math.max(1, Math.round((new Date(endIso).getTime() - new Date(row.started_at).getTime()) / 60000));
      if (!row.ended_at) await svc.from('hub_checkins').update({ ended_at: endIso, minutes: mins }).eq('id', id);
      const closed = await closeTasks(closeIds, name);
      const sid = await slackUserId(me.email);
      /* wave192: no clock time and no duration in the post */
      let text = ':white_circle: ' + mention(name, sid) + ' checked out';
      if (bullets.length) text += '\n' + bullets.map(b => '• ' + b).join('\n');
      text += closedLine(closed);
      const r = await postOld(text);
      await svc.from('hub_checkins').update({ slack_out_ts: r.ts, share_to: 'everyone', share_channel: r.ts ? OLD_CHANNEL : null, summary: bullets.length ? { bullets, closed: closeIds, skipped: body.skipped === true } : null, closed_task_ids: closeIds.length ? closeIds : null }).eq('id', id);
      return json({ ok: true, posted: !!r.ts, error: r.error, closed: closed.map(c => c.title), minutes: mins });
    }
    if (action === 'channels') {
      const tok = await getSecret('SLACK_BOT_TOKEN');
      const out = (await channels(tok)).map(c => ({ id: c.id, name: c.name, member: c.member, private: c.priv }));
      out.sort((a, b) => a.name.localeCompare(b.name));
      return json({ ok: true, channels: out });
    }
    if (action === 'say') {
      const want = String(body.channel || '').replace(/^#/, '').trim();
      const text = String(body.text || '').trim().slice(0, 3000);
      if (!want || !text) return json({ error: 'channel and text' }, 400);
      const tok = await getSecret('SLACK_BOT_TOKEN');
      const ch = await channelByName(tok, want);
      if (!ch) return json({ error: 'channel #' + want + ' not found (the bot can only see channels it is allowed to see)' }, 404);
      if (!ch.member) return json({ error: 'the bot is not in #' + want + '; add it from the channel' }, 400);
      const out = await slack(tok, 'chat.postMessage', { channel: ch.id, text: text + '\n_posted from the hub by ' + name + '_', unfurl_links: false, unfurl_media: false });
      if (!out.ok) return json({ error: String(out.error || 'slack refused') }, 400);
      return json({ ok: true, ts: String(out.ts || ''), channel: ch.id });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) { return json({ error: String((e as Error).message || e).slice(0, 300) }, 500); }
});
