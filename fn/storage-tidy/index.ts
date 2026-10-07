// Welfare Avenue: storage-tidy (v1, 06/10/26)
// Steel (06/10/26): "Can you package the videos in one folder so that I can delete it in one shot, and do the rest for other
// media not used in other folders". Moves files in the content-images bucket into a 'To delete/' folder so a person can
// review and delete them in one place in the Supabase dashboard. Nothing is ever deleted here.
//   {action:'move', moves:[{from, to}]}   up to 100 a call; from must be under Flagfootball 2026/, Good photos/ or
//                                        Gift basket drive/; to must start with 'To delete/'. Storage move keeps the bytes.
//   {action:'back', moves:[{from, to}]}   the reverse (from under 'To delete/' back to one of those folders), to undo.
// Auth: the trigger secret only (x-wa-secret), so only build sessions and the database can call it.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const BUCKET = 'content-images';
const SRC = /^(Flagfootball 2026|Good photos|Gift basket drive)\/[^]{1,300}$/;
const DST = /^To delete\/[^]{1,400}$/;
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  try {
    const { data: secret } = await svc.rpc('get_secret', { secret_name: 'WA_TRIGGER_SECRET' });
    if (!secret || req.headers.get('x-wa-secret') !== secret) return json({ error: 'not allowed' }, 401);
    const b = await req.json().catch(() => ({}));
    const back = b.action === 'back';
    if (b.action !== 'move' && !back) return json({ error: 'unknown action' }, 400);
    const moves = (Array.isArray(b.moves) ? b.moves : []).slice(0, 100);
    const out: Array<Record<string, unknown>> = [];
    for (const m of moves) {
      const from = String(m?.from || ''), to = String(m?.to || '');
      const ok = back ? (DST.test(from) && SRC.test(to)) : (SRC.test(from) && DST.test(to));
      if (!ok || from.includes('..') || to.includes('..')) { out.push({ from, ok: false, error: 'path not allowed' }); continue; }
      const { error } = await svc.storage.from(BUCKET).move(from, to);
      out.push(error ? { from, ok: false, error: error.message } : { from, to, ok: true });
    }
    return json({ ok: out.every(r => r.ok), moved: out.filter(r => r.ok).length, failed: out.filter(r => !r.ok) });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
