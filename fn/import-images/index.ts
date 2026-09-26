// Welfare Avenue: import-images
// Internal utility: fetches images server-side and re-hosts them in the
// public dept-images bucket, then points dept_meta.header_image_url at them.
// Auth: internal trigger secret only.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret unavailable');
  return data as string;
}

Deno.serve(async (req: Request) => {
  const given = req.headers.get('x-wa-secret');
  let expected = '';
  try { expected = await getSecret('WA_TRIGGER_SECRET'); } catch (_) { /* no-op */ }
  if (!given || given !== expected) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  const body = await req.json().catch(() => ({}));
  const items = (body.items || []) as Array<{ dept: string; url: string }>;
  const results: Array<Record<string, unknown>> = [];
  for (const it of items) {
    try {
      const res = await fetch(it.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) { results.push({ dept: it.dept, ok: false, status: res.status }); continue; }
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength < 5000) { results.push({ dept: it.dept, ok: false, error: 'too small, likely not an image' }); continue; }
      const path = it.dept + '.jpg';
      const up = await svc.storage.from('dept-images').upload(path, buf, { contentType: res.headers.get('content-type') || 'image/jpeg', upsert: true });
      if (up.error) { results.push({ dept: it.dept, ok: false, error: up.error.message }); continue; }
      const publicUrl = SUPABASE_URL + '/storage/v1/object/public/dept-images/' + path + '?v=' + Date.now();
      const upd = await svc.from('dept_meta').update({ header_image_url: publicUrl }).eq('department', it.dept);
      results.push({ dept: it.dept, ok: !upd.error, bytes: buf.byteLength, url: publicUrl });
    } catch (e) {
      results.push({ dept: it.dept, ok: false, error: String(e).slice(0, 200) });
    }
  }
  return new Response(JSON.stringify({ results }), { headers: { 'Content-Type': 'application/json' } });
});
