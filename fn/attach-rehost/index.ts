// Welfare Avenue: attach-rehost (v1)
// Copies ClickUp task attachments into the public 'sop-shots' storage bucket so
// the Sunday Serving SOP page can show them permanently. ClickUp attachment URLs
// are auth-required, single-use and expire in ~5 minutes, so they can never be
// hot-linked from the dashboard.
//
// POST { task_ids: string[], force?: boolean }
// Returns a per-attachment report: which URL variant worked, bytes, public path.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
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

type Att = {
  id: string; title?: string; extension?: string; mimetype?: string;
  url?: string; url_w_query?: string; url_w_host?: string;
};

/* Try each URL variant, with and without the ClickUp token, and keep the first
   response that is actually image bytes. ClickUp signs some variants by query
   string and gates others by header, and which one applies depends on whether
   private attachments are switched on for the workspace. */
async function grab(att: Att, token: string): Promise<{ bytes: Uint8Array; via: string; type: string } | { error: string }> {
  const variants: Array<[string, string | undefined]> = [
    ['url_w_query', att.url_w_query],
    ['url_w_host', att.url_w_host],
    ['url', att.url],
  ];
  const tried: string[] = [];
  for (const [label, url] of variants) {
    if (!url) continue;
    for (const withAuth of [false, true]) {
      try {
        const res = await fetch(url, { headers: withAuth ? { Authorization: token } : {} });
        const type = res.headers.get('content-type') || '';
        if (!res.ok) { tried.push(label + (withAuth ? '+auth' : '') + '=' + res.status); continue; }
        const buf = new Uint8Array(await res.arrayBuffer());
        if (buf.byteLength < 200 || !/^image\//.test(type)) {
          tried.push(label + (withAuth ? '+auth' : '') + '=' + type + '/' + buf.byteLength);
          continue;
        }
        return { bytes: buf, via: label + (withAuth ? '+auth' : ''), type };
      } catch (e) {
        tried.push(label + (withAuth ? '+auth' : '') + '=err');
      }
    }
  }
  return { error: 'no variant worked: ' + tried.join(', ') };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!(await authorize(req))) return json({ error: 'unauthorized' }, 401);

  const token = await getSecret('CLICKUP_TOKEN');
  if (!token) return json({ error: 'tokens_missing' }, 500);

  let body: { task_ids?: string[]; force?: boolean } = {};
  try { body = await req.json(); } catch (_) { /* empty body is fine */ }
  const taskIds = body.task_ids || [];
  if (!taskIds.length) return json({ error: 'task_ids required' }, 400);

  const report: Array<Record<string, unknown>> = [];
  let ok = 0, failed = 0, skipped = 0;

  for (const taskId of taskIds) {
    let atts: Att[] = [];
    try {
      const res = await fetch('https://api.clickup.com/api/v2/task/' + taskId, { headers: { Authorization: token } });
      const t = await res.json();
      atts = (t.attachments || []) as Att[];
    } catch (e) {
      report.push({ task_id: taskId, error: 'task fetch failed: ' + String(e) });
      failed++;
      continue;
    }

    for (const att of atts) {
      const ext = (att.extension || 'png').replace(/[^a-z0-9]/gi, '').toLowerCase();
      const path = taskId + '/' + att.id.replace(/\.[^.]+$/, '') + '.' + ext;

      if (!body.force) {
        const { data: existing } = await svc.storage.from(BUCKET)
          .list(taskId, { search: att.id.replace(/\.[^.]+$/, '') });
        if (existing && existing.length) {
          report.push({ task_id: taskId, attachment_id: att.id, title: att.title, path, status: 'already_there' });
          skipped++;
          continue;
        }
      }

      const got = await grab(att, token);
      if ('error' in got) {
        report.push({ task_id: taskId, attachment_id: att.id, title: att.title, status: 'failed', detail: got.error });
        failed++;
        continue;
      }
      const { error: upErr } = await svc.storage.from(BUCKET)
        .upload(path, got.bytes, { contentType: got.type, upsert: true });
      if (upErr) {
        report.push({ task_id: taskId, attachment_id: att.id, title: att.title, status: 'upload_failed', detail: upErr.message });
        failed++;
        continue;
      }
      report.push({
        task_id: taskId, attachment_id: att.id, title: att.title, path,
        status: 'stored', via: got.via, bytes: got.bytes.byteLength,
        public_url: SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + path,
      });
      ok++;
    }
  }

  return json({ ok, failed, skipped, total: report.length, report });
});
