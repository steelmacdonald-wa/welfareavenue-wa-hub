// wave165 (29/09/26): shout-outs count the open work people closed (not board-only, leadership, confidential or one-on-one work) (one-on-ones are only for the people speaking in them now: visibility speakers; restricted work never
// reaches a shout-out everyone sees).
// Welfare Avenue: shoutouts (v1, 25/09/26)
// Steel: "Can you make the did-you-knows give shout-outs to individuals in
// the organisation for completing projects or doing something amazing?"
// Once a day (cron wa-shoutouts) this reads what happened: projects marked
// done, who closed the most tasks this week, big weeks of checked-in hours,
// work anniversaries, new starters and new hires. Each becomes one warm
// line (the model phrases them through the router, task 'shoutout';
// templates if it cannot), written once (ref dedupes) into hub_shoutouts
// with a ten-day life. The hub shows them on the loading screen between
// the fun facts and in the HR centre, where staff can post their own.
// Actions: refresh (x-wa-secret or admin), add {person, text} (staff).
// v1.1 (wave149, 27/09/26): shout-outs also rotate on the loading screen for everyone, so a task or project whose title is about
// roles, leadership, handovers or anyone leaving is never named in one (the count stays), and a phrased line that mentions
// such things falls back to the plain template.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const TZ = 'America/Toronto';
const OPEN_VIS = 'visibility.is.null,visibility.eq.department'; /* wave165: open work only (not leadership, confidential or one-on-one) */
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
type Me = { email: string; name: string; admin: boolean } | { email: 'automation'; name: 'automation'; admin: true };
async function who(req: Request): Promise<Me | null> {
  try { const g = req.headers.get('x-wa-secret'); if (g && g === (await getSecret('WA_TRIGGER_SECRET'))) return { email: 'automation', name: 'automation', admin: true }; } catch (_) { /* no */ }
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  if (!(email.endsWith('@welfareavenue.com') || email === 'steelmacdonald@gmail.com')) return null;
  let admin = false; try { const { data: a } = await asUser.rpc('is_hub_admin'); admin = a === true; } catch (_) { admin = false; }
  const meta = (data?.user?.user_metadata || {}) as Record<string, string>;
  return { email, name: meta.full_name || meta.name || email.split('@')[0], admin };
}

const DEPT: Record<string, string> = { opsmtl: 'Operations Montreal', progdev: 'Program Development', opsto: 'Operations Toronto', marketing: 'Marketing', fundraising: 'Fundraising', hr: 'HR', board: 'the Board' };
type Member = { id: number; name: string; department: string | null; start_date: string | null; active: boolean; email: string | null };
type Item = { source: string; ref: string; person: string | null; member_id: number | null; team: string | null; facts: string; fallback: string };
function first(n: string): string { return String(n || '').trim().split(' ')[0]; }
function weekKey(): string { const d = new Date(); const onejan = new Date(d.getFullYear(), 0, 1); const wk = Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7); return d.getFullYear() + 'w' + wk; }
function niceDate(iso: string): string { return new Date(iso + 'T12:00:00').toLocaleDateString('en-CA', { month: 'long', day: 'numeric', timeZone: TZ }); }
function findMember(all: Member[], name: string): Member | null {
  const n = String(name || '').trim().toLowerCase(); if (!n) return null;
  return all.find(m => m.name.toLowerCase() === n) || all.filter(m => m.name.toLowerCase().split(' ')[0] === n.split(' ')[0])[0] || null;
}

async function collect(): Promise<Item[]> {
  const items: Item[] = [];
  const { data: mem } = await svc.from('team_members').select('id, name, department, start_date, active, email').eq('active', true);
  const all = ((mem || []) as Member[]).filter(m => !/\btest\b|^(info|hub|admin|donors?|jobs)$/i.test(String(m.name || '')) && !/^(info|hub|admin|donors?|jobs|steelmacdonald)@/i.test(String(m.email || '')));
  const wk = weekKey();
  const since14 = new Date(Date.now() - 14 * 86400000).toISOString();
  const since7 = new Date(Date.now() - 7 * 86400000).toISOString();

  /* 1. projects finished */
  const { data: projs } = await svc.from('projects').select('id, name, department, status, leads, updated_at').in('status', ['done', 'complete', 'completed', 'finished']).gte('updated_at', since14);
  for (const p of (projs || []) as Array<{ id: number; name: string; department: string | null; leads: unknown; updated_at: string }>) {
    if (PRIVATE.test(String(p.name || ''))) continue;
    const leads = Array.isArray(p.leads) ? (p.leads as unknown[]).map(String).filter(Boolean) : [];
    const lead = leads[0] ? findMember(all, leads[0]) : null;
    items.push({ source: 'project', ref: 'project:' + p.id, person: lead ? lead.name : (leads[0] || null), member_id: lead ? lead.id : null, team: p.department,
      facts: 'Project "' + p.name + '" (' + (DEPT[p.department || ''] || p.department || 'team') + ') was marked done' + (leads.length ? ', led by ' + leads.join(' and ') : ''),
      fallback: (leads.length ? leads.map(first).join(' and ') + ' and the ' : 'The ') + (DEPT[p.department || ''] || 'team') + ' team finished the ' + p.name + ' project.' });
  }
  /* 2. task closers this week */
  const { data: closed } = await svc.from('dept_tasks').select('updated_by, title').eq('done', true).eq('board_only', false).or(OPEN_VIS).gte('closed_at', since7);
  const byCloser: Record<string, { n: number; titles: string[] }> = {};
  for (const t of (closed || []) as Array<{ updated_by: string | null; title: string }>) {
    const who = String(t.updated_by || '').trim(); if (!who || /^(AI|Chat|Hub|dashboard|automation)/i.test(who)) continue;
    const m = findMember(all, who); if (!m) continue;
    (byCloser[m.name] = byCloser[m.name] || { n: 0, titles: [] }).n++; if (t.title && !PRIVATE.test(t.title)) byCloser[m.name].titles.push(t.title);
  }
  Object.keys(byCloser).sort((a, b) => byCloser[b].n - byCloser[a].n).slice(0, 3).forEach(name => {
    const c = byCloser[name]; if (c.n < 3) return; const m = findMember(all, name)!;
    items.push({ source: 'tasks', ref: 'tasks:' + m.id + ':' + wk, person: m.name, member_id: m.id, team: m.department,
      facts: m.name + ' closed ' + c.n + ' tasks this week' + (c.titles.length ? ', including "' + c.titles.slice(0, 2).join('", "') + '"' : ''),
      fallback: first(m.name) + ' closed ' + c.n + ' tasks this week' + (c.titles.length ? ', including "' + String(c.titles[0]).slice(0, 60) + '".' : '.') });
  });
  /* 3. big weeks on the hub */
  const { data: cks } = await svc.from('hub_checkins').select('email, name, minutes').gte('started_at', since7).not('minutes', 'is', null);
  const hrs: Record<string, number> = {};
  for (const c of (cks || []) as Array<{ email: string; name: string; minutes: number }>) hrs[c.email] = (hrs[c.email] || 0) + Number(c.minutes || 0);
  Object.keys(hrs).sort((a, b) => hrs[b] - hrs[a]).slice(0, 2).forEach(email => {
    const h = Math.round(hrs[email] / 60); if (h < 15) return;
    const m = all.find(x => (x.email || '').toLowerCase() === email.toLowerCase()); if (!m) return;
    items.push({ source: 'hours', ref: 'hours:' + m.id + ':' + wk, person: m.name, member_id: m.id, team: m.department, facts: m.name + ' checked in ' + h + ' hours on the hub this week', fallback: first(m.name) + ' put in ' + h + ' hours this week. Thank you.' });
  });
  /* 4. anniversaries in the coming week, 5. new starters */
  const today = new Date(); const y = today.getFullYear();
  for (const m of all) {
    if (!m.start_date) continue;
    const sd = new Date(m.start_date + 'T12:00:00'); const years = y - sd.getFullYear();
    const anniv = new Date(y, sd.getMonth(), sd.getDate(), 12); const diff = (anniv.getTime() - today.getTime()) / 86400000;
    if (years >= 1 && diff >= -1 && diff <= 7) items.push({ source: 'anniversary', ref: 'anniv:' + m.id + ':' + y, person: m.name, member_id: m.id, team: m.department, facts: m.name + ' marks ' + years + (years === 1 ? ' year' : ' years') + ' with Welfare Avenue on ' + niceDate(y + m.start_date.slice(4)), fallback: first(m.name) + ' marks ' + years + (years === 1 ? ' year' : ' years') + ' with Welfare Avenue on ' + niceDate(y + m.start_date.slice(4)) + '.' });
    const sinceStart = (today.getTime() - sd.getTime()) / 86400000;
    if (sinceStart >= 0 && sinceStart <= 14 && ['fundraising', 'hr', 'marketing', 'opsmtl', 'opsto', 'progdev'].indexOf(String(m.department || '')) >= 0) items.push({ source: 'welcome', ref: 'welcome:' + m.id, person: m.name, member_id: m.id, team: m.department, facts: m.name + ' joined ' + (DEPT[m.department || ''] || 'the team') + ' on ' + niceDate(m.start_date), fallback: 'Welcome ' + first(m.name) + ', who joined ' + (DEPT[m.department || ''] || 'the team') + ' this month.' });
  }
  /* 6. hires: no longer announced (v1.1, wave149 review): an accepted offer is not news for the loading screen, the role may be
     sensitive, and the person is welcomed once they are on a team's roster (5.) */
  const hired: unknown[] = [];
  for (const c of hired as Array<{ id: number; name: string; role: string | null }>) {
    items.push({ source: 'hire', ref: 'hire:' + c.id, person: c.name, member_id: null, team: 'hr', facts: c.name + ' accepted our offer' + (c.role ? ' for ' + c.role : ''), fallback: first(c.name) + ' is joining us' + (c.role ? ' as ' + c.role : '') + '. Welcome aboard.' });
  }
  return items;
}

const PRIVATE = /\b(managers?|coordinators?|treasurer|secretary|head of|promot(ed|es|ing|ion)|co-?directors?|directors?|hired|hiring|new hire|joins as|joined as|recruited as|stepped down|transition\w*|succession|successors?|succeed(s|ed|ing)?|hand(ing|ed|s)?[ -]?overs?|handed over|tak(e|es|ing|en)[ -]over|took over|now leads?|step(s|ped|ping)?\s+(down|back|away|aside|into|up)|resign\w*|departures?|departing|departed|(leav(e|es|ing)|left) (us|wa|welfare|the (team|org|organi[sz]ation|charity|board|role|hub))|moving on|retir(e|es|ed|ing)\b|replacement (for|of)|appoint(ed|s|ing)\b|nominat\w*|elected|election|new (role|position|title|ed|ceo|chair|president|director|lead(er)?)|executive team|role change|change of role|leadership|delegat\w*|chair(man|person|woman)?|president|executive directors?|co-?eds?|ed|ceo|interim|farewell|goodbyes?|good luck|best of luck|next chapter|new chapter|last day|offboard\w*|disciplin\w*|terminat\w*|salar(y|ies)|payroll|d\u00e9part\w*|passation|d\u00e9mission\w*)\b/i;
async function phrase(items: Item[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!items.length) return out;
  try {
    const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
      method: 'POST', headers: { Authorization: 'Bearer ' + SERVICE_KEY, 'x-wa-task': 'shoutout', 'x-wa-caller': 'shoutouts', 'Content-Type': 'application/json' },
      body: JSON.stringify({ max_tokens: 900, temperature: 0.5,
        system: 'You write one-line shout-outs for the loading screen of Welfare Avenue’s staff hub (a charity in Montreal and Toronto). Warm, specific, plain, under 22 words, no em dashes, no exclamation marks, no hashtags, first names only. Never invent details beyond the facts given.',
        messages: [{ role: 'user', content: 'FACTS, one per line with an id:\n' + items.map(i => i.ref + ' | ' + i.facts).join('\n') }],
        tools: [{ name: 'shoutouts', description: 'One line per id.', input_schema: { type: 'object', properties: { lines: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' } }, required: ['id', 'text'] } } }, required: ['lines'] } }],
        tool_choice: { type: 'tool', name: 'shoutouts' } })
    });
    if (!res.ok) return out;
    const body = await res.json();
    // deno-lint-ignore no-explicit-any
    const tu = (body.content || []).find((c: any) => c.type === 'tool_use');
    for (const l of ((tu && tu.input && tu.input.lines) || []) as Array<{ id: string; text: string }>) { const t = String(l.text || '').replace(/—/g, ',').trim(); if (t && t.length <= 180 && !PRIVATE.test(t)) out[String(l.id)] = t; }
  } catch (_) { /* templates then */ }
  return out;
}

async function refresh(): Promise<{ added: number; seen: number; lines: string[] }> {
  const items = await collect();
  const refs = items.map(i => i.ref);
  const { data: have } = refs.length ? await svc.from('hub_shoutouts').select('ref').in('ref', refs) : { data: [] };
  const known = new Set(((have || []) as Array<{ ref: string }>).map(r => r.ref));
  const fresh = items.filter(i => !known.has(i.ref) && !PRIVATE.test(i.fallback || '') && !PRIVATE.test(i.facts || ''));
  const phrased = await phrase(fresh);
  const rows = fresh.map(i => ({ kind: 'auto', source: i.source, ref: i.ref, person: i.person, member_id: i.member_id, team: i.team, text: phrased[i.ref] || i.fallback, by: 'the hub', expires_at: new Date(Date.now() + 10 * 86400000).toISOString() }));
  if (rows.length) { const { error } = await svc.from('hub_shoutouts').insert(rows); if (error) throw new Error(error.message); }
  await svc.from('hub_shoutouts').update({ active: false }).lt('expires_at', new Date().toISOString()).eq('active', true);
  return { added: rows.length, seen: items.length, lines: rows.map(r => r.text) };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const me = await who(req);
  if (!me) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || 'refresh');
  try {
    if (action === 'refresh') {
      if (!me.admin) return json({ error: 'admins only' }, 403);
      return json({ ok: true, ...(await refresh()) });
    }
    if (action === 'add') {
      const text = String(body.text || '').replace(/—/g, ',').trim().slice(0, 240);
      const person = String(body.person || '').trim().slice(0, 80);
      if (text.length < 4) return json({ error: 'Write the shout-out first.' }, 400);
      const { data: mem } = await svc.from('team_members').select('id, name, department').eq('active', true);
      const m = person ? findMember((mem || []) as Member[], person) : null;
      const { data: ins, error } = await svc.from('hub_shoutouts').insert({ kind: 'manual', source: 'manual', ref: null, person: m ? m.name : (person || null), member_id: m ? m.id : null, team: m ? m.department : null, text, by: me.name, expires_at: new Date(Date.now() + 14 * 86400000).toISOString() }).select('id').single();
      if (error) return json({ error: error.message }, 500);
      try { await svc.from('change_log').insert({ entity_type: 'shoutout', entity_id: String(ins.id), field: 'created', old_value: null, new_value: (m ? m.name + ': ' : '') + text, changed_by: me.name }); } catch (_) { /* audit */ }
      return json({ ok: true, id: ins.id });
    }
    if (action === 'remove') {
      const id = Number(body.id);
      const { data: row } = await svc.from('hub_shoutouts').select('id, by').eq('id', id).maybeSingle();
      if (!row) return json({ error: 'not found' }, 404);
      if (!me.admin && String(row.by || '').toLowerCase() !== me.name.toLowerCase()) return json({ error: 'not yours' }, 403);
      await svc.from('hub_shoutouts').update({ active: false }).eq('id', id);
      return json({ ok: true });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) { return json({ error: String((e as Error).message || e).slice(0, 300) }, 500); }
});
