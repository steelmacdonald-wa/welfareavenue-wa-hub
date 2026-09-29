// Welfare Avenue: photo-library (v3, 29/09/26; v2 28/09/26; v1 25/09/26)
// Puts photo files into the public content-images bucket under photos/ for
// the hub's Photo library (wa_photos). The hub itself uploads straight to
// storage with the signed-in person's session (staff can write to
// content-images); this function exists for build sessions and tools that
// hold the trigger secret instead of a sign-in.
// Auth: x-wa-secret (WA_TRIGGER_SECRET) or a staff sign-in.
// Actions:
//   {action:'put', files:[{path, content_b64, content_type?}]}
//        upload (upsert) each file; returns [{path, bytes, ok, error?}]
//   {action:'remove', paths:[...]}          trigger secret or hub admin only
//   {action:'check', paths:[...]}           which paths exist, with sizes
// Every path must start with photos/ and end in .jpg, .jpeg, .png or .webp.
//   {action:'sideline', paths:[...]}        v2, trigger secret or hub admin only: moves pictures that are not
//        right for the website into a 'Not for website' folder beside them, so a person can review and delete
//        them in one place. Nothing is deleted. Only for the upload folders named in SIDELINE (max 100 a call).
//        v3: {to: 'Duplicates'} moves a dashboard double upload ('name (1).jpg') into a Duplicates folder beside it, only
//        when the original ('name.jpg') is there with exactly the same size; 'Good photos' is allowed for this.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const BUCKET = 'content-images';
const SIDELINE = /^(Flagfootball 2026|Gift basket drive)\/([^\/]{1,160}\.(?:jpe?g|png|heic|webp))$/i;
const DUPLICATE = /^(Flagfootball 2026|Gift basket drive|Good photos)\/([^\/]{1,160}) \((\d{1,3})\)(\.[A-Za-z0-9]{2,5})$/;
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const PATH = /^photos\/[a-z0-9][a-z0-9\/_-]{0,120}\.(jpe?g|png|webp)$/;
const TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}
type Who = { kind: 'secret' | 'staff'; email: string | null; admin: boolean };
async function who(req: Request): Promise<Who | null> {
  const given = req.headers.get('x-wa-secret');
  if (given) { try { if (given === (await getSecret('WA_TRIGGER_SECRET'))) return { kind: 'secret', email: null, admin: true }; } catch (_) { /* fall through */ } }
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  if (!email) return null;
  let staff = false, admin = false;
  try { const r = await asUser.rpc('is_wa_staff'); staff = r.data === true; } catch (_) { staff = false; }
  if (!staff) return null;
  try { const r = await asUser.rpc('is_hub_admin'); admin = r.data === true; } catch (_) { admin = false; }
  return { kind: 'staff', email, admin };
}
function b64bytes(s: string): Uint8Array {
  const bin = atob(s.replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const me = await who(req);
  if (!me) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');
  try {
    if (action === 'put') {
      const files = Array.isArray(body.files) ? body.files.slice(0, 12) : [];
      const out: Array<Record<string, unknown>> = [];
      for (const f of files) {
        const path = String(f && f.path || '');
        if (!PATH.test(path)) { out.push({ path, ok: false, error: 'path must be photos/<name>.jpg|png|webp' }); continue; }
        const ext = path.split('.').pop()!.toLowerCase();
        let bytes: Uint8Array;
        try { bytes = b64bytes(String(f.content_b64 || '')); } catch (_) { out.push({ path, ok: false, error: 'content_b64 is not base64' }); continue; }
        if (bytes.byteLength < 200 || bytes.byteLength > 12 * 1024 * 1024) { out.push({ path, ok: false, error: 'size ' + bytes.byteLength }); continue; }
        const up = await svc.storage.from(BUCKET).upload(path, bytes, { contentType: String(f.content_type || TYPES[ext]), upsert: true, cacheControl: '604800' });
        out.push(up.error ? { path, ok: false, error: up.error.message } : { path, ok: true, bytes: bytes.byteLength });
      }
      return json({ ok: out.every(r => r.ok), files: out });
    }
    if (action === 'check') {
      const paths = (Array.isArray(body.paths) ? body.paths : []).map(String).filter(p => PATH.test(p)).slice(0, 200);
      const folders = [...new Set(paths.map(p => p.slice(0, p.lastIndexOf('/'))))];
      const found: Record<string, number> = {};
      for (const folder of folders) {
        const { data } = await svc.storage.from(BUCKET).list(folder, { limit: 1000 });
        (data || []).forEach(o => { found[folder + '/' + o.name] = Number((o.metadata as { size?: number } | null)?.size || 0); });
      }
      return json({ ok: true, files: paths.map(p => ({ path: p, exists: p in found, bytes: found[p] ?? null })) });
    }
    if (action === 'remove') {
      if (!me.admin) return json({ error: 'Only the trigger secret or a hub admin can remove files.' }, 403);
      const paths = (Array.isArray(body.paths) ? body.paths : []).map(String).filter(p => PATH.test(p)).slice(0, 100);
      const { data, error } = await svc.storage.from(BUCKET).remove(paths);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, removed: (data || []).map(o => o.name) });
    }
    if (action === 'sideline') {
      if (!me.admin) return json({ error: 'Only the trigger secret or a hub admin can move files.' }, 403);
      const paths = (Array.isArray(body.paths) ? body.paths : []).map(String).slice(0, 100);
      const out: Array<Record<string, unknown>> = [];
      if (body.to === 'Duplicates') { // v3: exact double uploads only
        const sizes: Record<string, Record<string, number>> = {};
        const sizeOf = async (folder: string, name: string) => {
          if (!sizes[folder]) {
            sizes[folder] = {};
            for (let off = 0; ; off += 1000) {
              const { data } = await svc.storage.from(BUCKET).list(folder, { limit: 1000, offset: off });
              (data || []).forEach(o => { sizes[folder][o.name] = Number((o.metadata as { size?: number } | null)?.size ?? -1); });
              if (!data || data.length < 1000) break;
            }
          }
          return sizes[folder][name];
        };
        for (const from of paths) {
          const m = DUPLICATE.exec(from);
          if (!m) { out.push({ from, ok: false, error: 'not a double upload in an allowed folder' }); continue; }
          const copy = from.slice(m[1].length + 1), orig = m[2] + m[4];
          const a = await sizeOf(m[1], copy), b = await sizeOf(m[1], orig);
          if (!(a > 0) || a !== b) { out.push({ from, ok: false, error: 'the original is missing or differs' }); continue; }
          const to = m[1] + '/Duplicates/' + copy;
          const { error } = await svc.storage.from(BUCKET).move(from, to);
          out.push(error ? { from, ok: false, error: error.message } : { from, to, ok: true });
        }
        return json({ ok: out.every(r => r.ok), moved: out.filter(r => r.ok).length, files: out });
      }
      for (const from of paths) {
        const m = SIDELINE.exec(from);
        if (!m) { out.push({ from, ok: false, error: 'not an allowed upload folder' }); continue; }
        const to = m[1] + '/Not for website/' + m[2];
        const { error } = await svc.storage.from(BUCKET).move(from, to);
        out.push(error ? { from, ok: false, error: error.message } : { from, to, ok: true });
      }
      return json({ ok: out.every(r => r.ok), moved: out.filter(r => r.ok).length, files: out });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e).slice(0, 300) }, 500);
  }
});
