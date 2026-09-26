// Welfare Avenue: sop-import (v1)
// Pulls the Sunday Serving Program (MTL) ClickUp list into sop_template and
// sop_shots. Re-runnable: ClickUp stays the place the SOP is authored, the
// dashboard is where it gets worked. Descriptions are copied verbatim except
// that shared passwords are scrubbed on the way through.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const LIST_ID = '901710985224';
const BUCKET = 'sop-shots';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function getSecret(name: string): Promise<string | null> {
  const { data } = await svc.rpc('get_secret', { secret_name: name });
  return (data as string) || null;
}
async function authorize(req: Request): Promise<boolean> {
  try {
    const given = req.headers.get('x-wa-secret');
    if (given && given === (await getSecret('WA_TRIGGER_SECRET'))) return true;
  } catch (_) { /* fall through */ }
  const authHeader = req.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data } = await asUser.auth.getUser();
    if ((data?.user?.email || '').toLowerCase().endsWith('@welfareavenue.com')) return true;
  }
  return false;
}

/* Which part of the run-up each section belongs to, so the checklist reads in
   the order the team actually works it. */
const PHASE: Record<string, string> = {
  'Coordinating & Confirming All Volunteers': 't_minus_2w',
  'Coordinate & Confirm Donation Pick Up & Drop Offs': 't_minus_2w',
  'Location Specific Requirements': 't_minus_2w',
  'Inventory Management (X)': 't_minus_1w',
  'Itineraries': 'week_of',
  'Day-Of Event Support': 'event_day',
  'Post Event': 'post_event',
  'Feedback & KPI tracking': 'post_event',
};

/* The three ClickUp comments. Each is an instruction that appears nowhere in the
   task description, so it would be lost in a plain copy. */
const REVIEW: Record<string, [boolean, string]> = {
  '86e04vjb5': [true, 'Steel asked Dev Jawa on 13 Mar 2026 to reformulate the template email below. Treat the wording here as the old version until that comes back.'],
  '86e04vj8k': [true, 'Steel asked Ian Odhiambo and Patricia Kamara on 4 Mar 2026 to add the steps for prepping future photographers, for example a Google Photos album to upload to. Those steps are not written yet.'],
  '86e04vjxc': [false, 'Steel noted on 11 Mar 2026 that Patricia Kamara and Ian Odhiambo can SOP this section further.'],
};

const SECRET = /REDACTED/g; // REDACTED by audit 2026-09-26: the live source hard-codes a shared volunteer password here (as a scrub pattern). Move it to the vault (get_secret) before committing.
const SCRUB = '(password lives in the WA password manager, ask Steel or Suhaib)';

type CuTask = {
  id: string; name: string; url?: string; orderindex?: string;
  description?: string; markdown_description?: string;
  parent?: string | null; status?: { status?: string };
  attachments?: Array<{ id: string; title?: string; extension?: string }>;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!(await authorize(req))) return json({ error: 'unauthorized' }, 401);
  const token = await getSecret('CLICKUP_TOKEN');
  if (!token) return json({ error: 'tokens_missing' }, 500);

  /* 1. read every task in the list, subtasks included */
  const tasks: CuTask[] = [];
  for (let page = 0; page < 20; page++) {
    const url = 'https://api.clickup.com/api/v2/list/' + LIST_ID +
      '/task?archived=false&subtasks=true&include_closed=true&include_markdown_description=true&page=' + page;
    const res = await fetch(url, { headers: { Authorization: token } });
    const body = await res.json();
    const batch = (body.tasks || []) as CuTask[];
    tasks.push(...batch);
    if (batch.length < 100) break;
  }
  if (!tasks.length) return json({ error: 'no tasks returned' }, 502);

  const byId = new Map(tasks.map(t => [t.id, t]));
  const known = (p?: string | null) => (p && byId.has(p) ? p : null);

  /* 2. depth-first walk so `sort` matches the order a human reads the list */
  const kids = new Map<string, CuTask[]>();
  const roots: CuTask[] = [];
  for (const t of tasks) {
    const p = known(t.parent);
    if (p) { const a = kids.get(p) || []; a.push(t); kids.set(p, a); }
    else roots.push(t);
  }
  const byOrder = (a: CuTask, b: CuTask) => parseFloat(a.orderindex || '0') - parseFloat(b.orderindex || '0');
  roots.sort(byOrder);
  for (const a of kids.values()) a.sort(byOrder);

  const rows: Array<Record<string, unknown>> = [];
  const shots: Array<Record<string, unknown>> = [];
  let sort = 0;

  const walk = (t: CuTask, depth: number, section: string) => {
    const raw = t.markdown_description ?? t.description ?? null;
    const hasSecret = !!raw && SECRET.test(raw);
    SECRET.lastIndex = 0;
    const desc = raw && raw.trim() ? raw.replace(SECRET, SCRUB) : null;
    const [needsReview, reviewNote] = REVIEW[t.id] || [false, null];

    rows.push({
      id: t.id, parent_id: known(t.parent), depth, sort: sort++,
      section, name: t.name, description: desc,
      clickup_url: t.url || 'https://app.clickup.com/t/' + t.id,
      phase: PHASE[section] || 'anytime',
      needs_review: needsReview, review_note: reviewNote,
      has_secret: hasSecret, active: true,
      updated_at: new Date().toISOString(),
    });

    (t.attachments || []).forEach((a, i) => {
      const ext = (a.extension || 'png').replace(/[^a-z0-9]/gi, '').toLowerCase();
      const path = t.id + '/' + a.id.replace(/\.[^.]+$/, '') + '.' + ext;
      shots.push({
        template_id: t.id, attachment_id: a.id, title: a.title || null,
        storage_path: path,
        public_url: SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + path,
        sort: i,
      });
    });

    for (const c of (kids.get(t.id) || [])) walk(c, depth + 1, section);
  };
  for (const r of roots) walk(r, 0, r.name);

  /* 3. write parents before children so the self-reference always resolves */
  const { error: tErr } = await svc.from('sop_template').upsert(rows, { onConflict: 'id' });
  if (tErr) return json({ error: 'template upsert failed', detail: tErr.message }, 500);

  let shotErr: string | null = null;
  if (shots.length) {
    const { error } = await svc.from('sop_shots').upsert(shots, { onConflict: 'template_id,attachment_id' });
    if (error) shotErr = error.message;
  }

  /* 4. anything that vanished from ClickUp stops appearing on new checklists */
  const ids = rows.map(r => r.id as string);
  await svc.from('sop_template').update({ active: false }).not('id', 'in', '(' + ids.map(i => '"' + i + '"').join(',') + ')');

  const { data: seeded } = await svc.rpc('sop_sync_all_events');

  return json({
    tasks: tasks.length, template_rows: rows.length, shots: shots.length,
    with_description: rows.filter(r => r.description).length,
    secrets_scrubbed: rows.filter(r => r.has_secret).length,
    steps_seeded: seeded ?? 0,
    shot_error: shotErr,
  });
});
