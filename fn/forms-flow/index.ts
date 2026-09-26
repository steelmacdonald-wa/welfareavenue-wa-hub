// Welfare Avenue: forms-flow (v1, wave145, 26/09/26)
// The Google Forms Welfare Avenue uses, flowing into the Hub. For each form in form_sources:
//   volunteer_feedback  the survey volunteers fill in after a serving: each answer goes on the event it follows (the latest
//                       serving in the six days before), and when an event has two answers or more the router writes a short
//                       summary (form_summaries, scope event:<id>), rewritten only when the count changes;
//   event_audit         the event lead's audit and restock form: on the event of its EVENT DATE;
//   volunteer_signup    the recurrent volunteers form: a person already in the volunteer list is updated (last applied, roles);
//                       a new person is added for review (needs_review, with what they signed up for);
//   onboarding_quiz     the policy quiz and the 30 day quiz: matched to the person (their Google account, else their name),
//                       the score kept, and the step ticked in their onboarding when one is open.
// Each answer is stored once as question and answer text (form_responses); what the Hub did is kept in done, so nothing is
// done twice. Actions: status; sync {form_id?, dry?} (dry for the automation only; nothing written).
// Callers: the trigger secret (every six hours), or a signed-in leader, HR or an admin (Sync now).
// Google: the service account acting as steel.macdonald@welfareavenue.com (domain-wide delegation, scope drive; the Forms API
// accepts the drive scope for forms.get and forms.responses.list).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const ACTOR = 'steel.macdonald@welfareavenue.com';
const SCOPE = 'https://www.googleapis.com/auth/drive';
const TZ = 'America/Toronto';
const DOMAIN = '@welfareavenue.com';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}
/* who is asking: the automation, or a signed-in leader, HR person or admin */
async function caller(req: Request): Promise<string | null> {
  try { const s = req.headers.get('x-wa-secret'); if (s && s === (await getSecret('WA_TRIGGER_SECRET'))) return 'automation'; } catch (_) { /* no */ }
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  let ok = false;
  for (const fn of ['is_hub_leader', 'wa_is_hr', 'wa_org_editor']) { try { const r = await asUser.rpc(fn); if (r.data === true) { ok = true; break; } } catch (_) { /* next */ } }
  if (!ok) return null;
  const { data } = await asUser.auth.getUser();
  return (data?.user?.email || '').toLowerCase() || null;
}

/* ---------- Google ---------- */
function b64url(bytes: Uint8Array): string { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function pemToDer(pem: string): Uint8Array { const body = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, ''); const raw = atob(body); const out = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out; }
let TOKEN: { v: string; exp: number } | null = null;
async function token(): Promise<string> {
  if (TOKEN && Date.now() < TOKEN.exp - 120000) return TOKEN.v;
  const sa = JSON.parse(await getSecret('GOOGLE_SA_KEY'));
  const now = Math.floor(Date.now() / 1000), enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64url(enc.encode(JSON.stringify({ iss: sa.client_email, sub: ACTOR, scope: SCOPE, aud: sa.token_uri, iat: now, exp: now + 3600 })));
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(header + '.' + claims)));
  const res = await fetch(sa.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: header + '.' + claims + '.' + b64url(sig) }) });
  const body = await res.json();
  if (!body.access_token) throw new Error('Google refused the token: ' + String(body.error_description || body.error || res.status).slice(0, 200));
  TOKEN = { v: body.access_token, exp: Date.now() + 3500 * 1000 };
  return TOKEN.v;
}
async function g(url: string): Promise<Row> {
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + (await token()) } });
  const txt = await res.text(); let j: Row = {}; try { j = txt ? JSON.parse(txt) : {}; } catch (_) { j = { raw: txt.slice(0, 200) }; }
  if (!res.ok) throw new Error('GET ' + url.replace(/\?.*$/, '').replace(/^https:\/\/[^/]+/, '') + ': ' + res.status + ' ' + String(j?.error?.message || txt).slice(0, 200));
  return j;
}

/* ---------- a form: its questions in order, and its answers as text ---------- */
type Q = { id: string; title: string; type: string; points: number };
function questionsOf(form: Row): Q[] {
  const out: Q[] = [];
  for (const it of form.items || []) {
    const title = String(it.title || '').replace(/\s+/g, ' ').trim();
    if (it.questionItem?.question) {
      const q = it.questionItem.question;
      const type = Object.keys(q).filter((k) => !['questionId', 'required', 'grading'].includes(k))[0] || 'question';
      out.push({ id: q.questionId, title, type, points: Number(q.grading?.pointValue || 0) });
    } else if (it.questionGroupItem) {
      for (const q of it.questionGroupItem.questions || []) out.push({ id: q.questionId, title: title + ': ' + String(q.rowQuestion?.title || '').trim(), type: 'grid', points: Number(q.grading?.pointValue || 0) });
    }
  }
  return out;
}
function answersOf(resp: Row, qs: Q[]): { q: string; a: string }[] {
  const out: { q: string; a: string }[] = [];
  for (const q of qs) {
    const a = resp.answers?.[q.id];
    if (!a) continue;
    const vals = (a.textAnswers?.answers || []).map((x: Row) => String(x.value ?? '').trim()).filter(Boolean);
    if (a.fileUploadAnswers?.answers?.length) vals.push(a.fileUploadAnswers.answers.length + ' file(s)');
    if (vals.length) out.push({ q: q.title, a: vals.join('; ') });
  }
  return out;
}
const lower = (s: unknown) => String(s || '').trim().toLowerCase();
function pick(ans: { q: string; a: string }[], re: RegExp, not?: RegExp): string { const x = ans.find((r) => re.test(r.q) && !(not && not.test(r.q))); return x ? x.a : ''; }
function emailIn(s: string): string { const m = String(s || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i); return m ? m[0].toLowerCase() : ''; }
function digits(s: string): string { const d = String(s || '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : ''; }
function tDay(iso: string): string { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)); }
function addDays(day: string, n: number): string { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function norm(s: unknown): string { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
/* a written name to one person: the full name, the first name with the last name or its initial, or a first name only one has */
function nameMatch(written: string, people: { id: number; names: string[] }[]): number | null {
  const d = norm(written); if (!d) return null;
  const exact = people.filter((p) => p.names.some((n) => norm(n) === d));
  if (exact.length === 1) return exact[0].id;
  if (exact.length > 1) return null;
  const dt = d.split(' ');
  const hits = people.filter((p) => p.names.some((n) => { const t = norm(n).split(' '); if (!t[0] || t[0] !== dt[0]) return false; if (dt.length === 1) return true; const last = t[t.length - 1], dl = dt[dt.length - 1]; return t.length > 1 && (last === dl || (dl.length === 1 && last[0] === dl)); }));
  return hits.length === 1 ? hits[0].id : null;
}
const ROLE: [RegExp, string][] = [[/cook|chef|kitchen/i, 'cook'], [/driv/i, 'driver'], [/serv/i, 'server'], [/photo|video/i, 'photographer'], [/lead/i, 'team_leader'], [/dish|wash|clean/i, 'dishwasher'], [/talk|community|greet/i, 'community_talker']];

/* ---------- the router: a short summary of one event's volunteer survey ---------- */
async function summarize(eventLabel: string, answers: { q: string; a: string }[][]): Promise<{ text: string; model: string | null }> {
  const lines = answers.map((ans, i) => 'Volunteer ' + (i + 1) + ':\n' + ans.filter((x) => !/contact|e-?mail|phone|cell/i.test(x.q)).map((x) => '- ' + x.q.slice(0, 90) + ': ' + x.a.slice(0, 400)).join('\n')).join('\n\n');
  const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
    method: 'POST', headers: { Authorization: 'Bearer ' + SERVICE_KEY, 'x-wa-task': 'digest', 'x-wa-caller': 'forms-flow', 'Content-Type': 'application/json' },
    body: JSON.stringify({ max_tokens: 500, temperature: 0.3,
      system: 'You summarise the survey volunteers fill in after a Welfare Avenue serving (a charity in Montreal and Toronto that serves meals to people in need). Three or four plain sentences for the operations team: how the volunteers found it, what beneficiaries needed and what slowed service, and the one or two suggestions worth acting on. Warm and specific, no em dashes, no exclamation marks, no names. Only use what the answers say; if they are thin, say so briefly.',
      messages: [{ role: 'user', content: eventLabel + '\n\n' + lines }],
      tools: [{ name: 'summary', description: 'The summary.', input_schema: { type: 'object', properties: { body: { type: 'string' } }, required: ['body'] } }], tool_choice: { type: 'tool', name: 'summary' } })
  });
  const body = await res.json().catch(() => ({}));
  const tu = (body.content || []).find((c: Row) => c.type === 'tool_use');
  const text = tu && tu.input && tu.input.body ? String(tu.input.body).replace(/—/g, ',').trim() : '';
  return { text, model: (body._wa && body._wa.model) || body.model || null };
}

/* ---------- the sync ---------- */
async function sync(onlyId: string | null, dry: boolean) {
  const { data: sources, error } = await svc.from('form_sources').select('*').eq('enabled', true).order('sort');
  if (error) throw new Error(error.message);
  const [ev, tm, dir, onb] = await Promise.all([
    svc.from('volunteer_events').select('id,event_date,kind,status,title,location,code'),
    svc.from('team_members').select('id,name,email,active'),
    svc.from('hub_directory').select('email,member_id,aliases,full_name'),
    svc.from('onboardings').select('id,member_id,status,started_at')
  ]);
  const events = ((ev.data || []) as Row[]).filter((e) => !/cancel/i.test(String(e.status || '')));
  const members = (tm.data || []) as Row[];
  const byEmail = new Map<string, number>();
  for (const m of members) if (m.email) byEmail.set(lower(m.email), Number(m.id));
  for (const d of dir.data || []) { if (!d.member_id) continue; byEmail.set(lower(d.email), Number(d.member_id)); for (const a of d.aliases || []) byEmail.set(lower(a), Number(d.member_id)); }
  const dirName = new Map<number, string>(); for (const d of dir.data || []) if (d.member_id && d.full_name) dirName.set(Number(d.member_id), d.full_name);
  const people = members.filter((m) => m.active !== false).map((m) => ({ id: Number(m.id), names: [m.name, dirName.get(Number(m.id)) || ''].filter(Boolean) }));
  const report: Row[] = [];
  const later: (() => Promise<void>)[] = [];
  for (const src of (sources || []) as Row[]) {
    if (onlyId && src.form_id !== onlyId) continue;
    const rep: Row = { form: src.label, kind: src.kind };
    try {
      const form = await g('https://forms.googleapis.com/v1/forms/' + src.form_id);
      const qs = questionsOf(form);
      const maxScore = qs.reduce((s, q) => s + q.points, 0) || null;
      const resps: Row[] = []; let pt = '';
      for (let i = 0; i < 20; i++) { const j = await g('https://forms.googleapis.com/v1/forms/' + src.form_id + '/responses?pageSize=5000' + (pt ? '&pageToken=' + pt : '')); resps.push(...(j.responses || [])); pt = j.nextPageToken || ''; if (!pt) break; }
      const { data: have } = await svc.from('form_responses').select('response_id,done,volunteer_id,member_id,event_id').eq('form_id', src.form_id);
      const haveMap = new Map<string, Row>(((have || []) as Row[]).map((r) => [r.response_id, r]));
      const rows: Row[] = [];
      for (const r of resps) {
        const at = r.lastSubmittedTime || r.createTime; if (!at) continue;
        const ans = answersOf(r, qs);
        const row: Row = { response_id: r.responseId, form_id: src.form_id, kind: src.kind, submitted_at: at, respondent_email: r.respondentEmail ? lower(r.respondentEmail) : null,
          name: pick(ans, /\bname\b/i, /team name|organi[sz]ation|company/i).slice(0, 120) || null, answers: ans,
          score: r.totalScore != null ? Number(r.totalScore) : null, max_score: r.totalScore != null ? maxScore : null, synced_at: new Date().toISOString() };
        /* the event: the audit's own date, else the latest serving in the six days before the answer */
        if (src.kind === 'volunteer_feedback' || src.kind === 'event_audit') {
          const day = tDay(at);
          const said = src.kind === 'event_audit' ? (pick(ans, /event date|date of the event/i).match(/\d{4}-\d{2}-\d{2}/) || [''])[0] : '';
          let best: Row | null = null;
          if (said) best = events.filter((e) => e.event_date === said)[0] || events.filter((e) => e.event_date >= addDays(said, -2) && e.event_date <= addDays(said, 2)).sort((a, b) => Math.abs(new Date(a.event_date).getTime() - new Date(said).getTime()) - Math.abs(new Date(b.event_date).getTime() - new Date(said).getTime()))[0] || null;
          if (!best) best = events.filter((e) => e.event_date <= day && e.event_date >= addDays(day, -6)).sort((a, b) => (a.kind === 'service' ? 0 : 1) - (b.kind === 'service' ? 0 : 1) || String(b.event_date).localeCompare(String(a.event_date)))[0] || null;
          row.event_id = best ? Number(best.id) : null;
        }
        /* the person who took a quiz */
        if (src.kind === 'onboarding_quiz') {
          const em = row.respondent_email || emailIn(pick(ans, /e-?mail/i));
          row.member_id = (em && byEmail.get(em)) || (row.name ? nameMatch(row.name, people) : null) || null;
        }
        rows.push(row);
      }
      rep.responses = rows.length;
      rep.new = rows.filter((r) => !haveMap.has(r.response_id)).length;
      if (src.kind === 'volunteer_feedback' || src.kind === 'event_audit') rep.matched_events = rows.filter((r) => r.event_id).length;
      if (src.kind === 'onboarding_quiz') rep.matched_people = rows.filter((r) => r.member_id).length;
      const last = rows.reduce((m, r) => (r.submitted_at > m ? r.submitted_at : m), '');
      if (!dry) {
        await svc.from('form_sources').update({ title: form.info?.title || form.info?.documentTitle || null, responder_url: form.responderUri || null, edit_url: 'https://docs.google.com/forms/d/' + src.form_id + '/edit',
          questions: qs.map((q) => ({ title: q.title, type: q.type, points: q.points || undefined })), responses_n: rows.length, last_response_at: last || null, last_synced_at: new Date().toISOString(), last_note: null, updated_at: new Date().toISOString() }).eq('form_id', src.form_id);
        for (let i = 0; i < rows.length; i += 200) { const { error: e } = await svc.from('form_responses').upsert(rows.slice(i, i + 200), { onConflict: 'response_id' }); if (e) throw new Error('form_responses: ' + e.message); }
      }
      /* what the Hub does with the answers it has not handled yet */
      const todo = rows.filter((r) => !(haveMap.get(r.response_id) || {}).done);
      if (src.kind === 'volunteer_signup') rep.did = await signups(todo, src, dry);
      if (src.kind === 'onboarding_quiz') rep.did = await quizzes(todo, src, onb.data || [], dry);
      if (src.kind === 'volunteer_feedback' || src.kind === 'event_audit') { if (!dry) for (const r of todo) await svc.from('form_responses').update({ done: { event_id: r.event_id || null } }).eq('response_id', r.response_id); }
      /* the summaries come last, within the time left (the router takes a few seconds each) */
      if (src.kind === 'volunteer_feedback') later.push(() => summaries(rows, src, events, dry).then((d) => { rep.did = d; }));
    } catch (e) {
      rep.error = String((e as Error).message || e).slice(0, 300);
      if (!dry) await svc.from('form_sources').update({ last_synced_at: new Date().toISOString(), last_note: rep.error }).eq('form_id', src.form_id);
    }
    report.push(rep);
  }
  for (const f of later) { try { await f(); } catch (e) { report.push({ summaries_error: String((e as Error).message || e).slice(0, 200) }); } }
  return report;
}

/* the recurrent volunteers form: into the volunteer list */
async function signups(todo: Row[], src: Row, dry: boolean) {
  const { data: vp } = await svc.from('volunteer_people').select('id,full_name,emails,phones,roles,last_applied');
  const list = (vp || []) as Row[];
  const out = { updated: 0, created: 0, skipped_old: 0 };
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString();
  for (const r of todo) {
    const ans = r.answers as { q: string; a: string }[];
    const name = r.name || '';
    const email = emailIn(pick(ans, /e-?mail/i)) || r.respondent_email || '';
    const phone = digits(pick(ans, /cell|phone|number/i));
    const position = pick(ans, /position|role/i), often = pick(ans, /how often|frequen/i);
    const roles = ROLE.filter(([re]) => re.test(position)).map(([, k]) => k);
    const day = tDay(r.submitted_at);
    const found = list.find((p) => (email && (p.emails || []).some((e: string) => lower(e) === email)) || (phone && (p.phones || []).some((x: string) => digits(x) === phone)));
    let done: Row;
    if (found) {
      const patch: Row = {};
      if (!found.last_applied || found.last_applied < day) patch.last_applied = day;
      const merged = Array.from(new Set([...(found.roles || []), ...roles]));
      if (merged.length !== (found.roles || []).length) patch.roles = merged;
      if (!dry && Object.keys(patch).length) await svc.from('volunteer_people').update(patch).eq('id', found.id);
      done = { volunteer: 'updated', volunteer_id: found.id };
      out.updated++;
      if (!dry) await svc.from('form_responses').update({ volunteer_id: found.id, done }).eq('response_id', r.response_id);
    } else if (r.submitted_at < yearAgo || !name) {
      done = { volunteer: 'not added', why: !name ? 'no name' : 'signed up more than a year ago' };
      out.skipped_old++;
      if (!dry) await svc.from('form_responses').update({ done }).eq('response_id', r.response_id);
    } else {
      const row = { full_name: name.slice(0, 120), emails: email ? [email] : [], phones: phone ? [phone] : [], roles, needs_review: true,
        review_note: ('New from the ' + src.label + ' form on ' + day + (position ? ': ' + position : '') + (often ? '; ' + often : '')).slice(0, 300), last_applied: day, joined_note: src.label };
      if (!dry) {
        const { data: ins, error } = await svc.from('volunteer_people').insert(row).select('id').single();
        if (error) throw new Error('volunteer_people: ' + error.message);
        done = { volunteer: 'created', volunteer_id: ins.id };
        await svc.from('form_responses').update({ volunteer_id: ins.id, done }).eq('response_id', r.response_id);
        list.push({ id: ins.id, full_name: row.full_name, emails: row.emails, phones: row.phones, roles, last_applied: day });
      }
      out.created++;
    }
  }
  return out;
}

/* the onboarding quizzes: tick the step in the person's open onboarding */
async function quizzes(todo: Row[], src: Row, onb: Row[], dry: boolean) {
  const out = { ticked: 0, no_onboarding: 0, unmatched: 0 };
  for (const r of todo) {
    /* an answer from the last thirty days is tried again on the next run: the person or their onboarding may be added later */
    const settled = new Date(r.submitted_at).getTime() < Date.now() - 30 * 86400000;
    if (!r.member_id) { out.unmatched++; if (!dry && settled) await svc.from('form_responses').update({ done: { onboarding: 'no person matched' } }).eq('response_id', r.response_id); continue; }
    const open = onb.filter((o) => Number(o.member_id) === Number(r.member_id) && o.status !== 'completed' && (!o.started_at || new Date(o.started_at).getTime() - 14 * 86400000 <= new Date(r.submitted_at).getTime()));
    let ticked: Row | null = null;
    for (const o of open) {
      if (!src.quiz_step) break;
      const { data: step } = await svc.from('onboarding_steps').select('id,done').eq('onboarding_id', o.id).eq('template_id', src.quiz_step).maybeSingle();
      if (step && !step.done) {
        if (!dry) await svc.from('onboarding_steps').update({ done: true, done_at: r.submitted_at, done_by: 'Google Form: ' + src.label + (r.score != null ? ' (' + r.score + (r.max_score ? ' of ' + r.max_score : '') + ')' : '') }).eq('id', step.id);
        ticked = { onboarding_id: o.id, step_id: step.id }; break;
      }
    }
    if (ticked) out.ticked++; else out.no_onboarding++;
    if (!dry && (ticked || settled)) await svc.from('form_responses').update({ done: ticked ? { onboarding: 'ticked', ...ticked } : { onboarding: 'no open onboarding step' } }).eq('response_id', r.response_id);
  }
  return out;
}

/* the volunteer survey: a summary per event once it has two answers, rewritten when the count changes */
async function summaries(rows: Row[], src: Row, events: Row[], dry: boolean) {
  const by = new Map<number, Row[]>();
  for (const r of rows) if (r.event_id) (by.get(r.event_id) || by.set(r.event_id, []).get(r.event_id)!).push(r);
  const { data: have } = await svc.from('form_summaries').select('scope,n').eq('form_id', src.form_id);
  const haveN = new Map<string, number>(((have || []) as Row[]).map((s) => [s.scope, s.n]));
  const out = { written: 0, kept: 0, left: 0 };
  const jobs: [number, Row[]][] = [];
  for (const [eid, list] of by) {
    if (list.length < 2) continue;
    if (haveN.get('event:' + eid) === list.length) { out.kept++; continue; }
    if (dry) { out.written++; continue; }
    jobs.push([eid, list]);
  }
  /* newest events first, three at a time, until about a minute and a half has gone; the rest wait for the next run */
  jobs.sort((a, b) => String(b[1][0].submitted_at).localeCompare(String(a[1][0].submitted_at)));
  const one = async ([eid, list]: [number, Row[]]) => {
    const e = events.find((x) => Number(x.id) === eid) || {};
    const s = await summarize('Serving on ' + (e.event_date || '') + (e.location ? ' at ' + e.location : '') + ': ' + list.length + ' volunteers answered.', list.map((r) => r.answers));
    if (!s.text) return;
    await svc.from('form_summaries').upsert({ form_id: src.form_id, scope: 'event:' + eid, n: list.length, summary: s.text, model: s.model, created_at: new Date().toISOString() }, { onConflict: 'form_id,scope' });
    out.written++;
  };
  while (jobs.length) {
    if (Date.now() - STARTED > 90000) { out.left = jobs.length; break; }
    await Promise.all(jobs.splice(0, 3).map(one));
  }
  return out;
}

let STARTED = Date.now();
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  STARTED = Date.now();
  const who = await caller(req);
  if (!who) return json({ error: 'Only leaders, HR, admins and the scheduled run can do this' }, 401);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || 'status');
  try {
    if (action === 'status') {
      const { data } = await svc.from('form_sources').select('form_id,kind,label,title,enabled,responses_n,last_response_at,last_synced_at,last_note').order('sort');
      return json({ ok: true, sources: data || [] });
    }
    if (action === 'sync') {
      const dry = body.dry === true && who === 'automation';
      const report = await sync(body.form_id ? String(body.form_id) : null, dry);
      const acted = report.some((r) => r.new || r.error || (r.did && Object.values(r.did).some((v) => Number(v) > 0 && !('kept' in r.did && Object.keys(r.did).length === 2 && r.did.written === 0))));
      if (!dry && (acted || who !== 'automation')) await svc.from('change_log').insert({ entity_type: 'forms', entity_id: body.form_id ? String(body.form_id) : 'all', field: 'sync', old_value: null, new_value: JSON.stringify(report).slice(0, 900), changed_by: who === 'automation' ? 'forms-flow' : who });
      return json({ ok: true, dry, report });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e).slice(0, 500) }, 500);
  }
});
