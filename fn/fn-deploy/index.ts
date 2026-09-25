// Welfare Avenue: fn-deploy (v1.1, 25/09/26)
// Lets the build push edge functions from the repo instead of pasting
// source by hand. Talks to the Supabase Management API with the personal
// access token Steel keeps in the vault as SUPABASE_ACCESS_TOKEN.
// Actions (x-wa-secret only; this is a build tool, not a Hub feature):
//   list                      -> the project's functions (slug, version, verify_jwt)
//   get {name}                -> {bundle_b64 (the eszip), verify_jwt, version}; build/fn.py pulls index.ts out
//   deploy {name, source, verify_jwt?} -> deploys index.ts, returns the new version
// Every deploy is written to change_log (edge_function/<name>: version).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const REF = new URL(SUPABASE_URL).hostname.split('.')[0];
const API = 'https://api.supabase.com/v1/projects/' + REF;
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
const NAME = /^[a-z0-9][a-z0-9-]{1,60}$/;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let secret = '';
  try { secret = await getSecret('WA_TRIGGER_SECRET'); } catch (_) { return json({ error: 'trigger secret unavailable' }, 500); }
  if ((req.headers.get('x-wa-secret') || '') !== secret) return json({ error: 'unauthorized' }, 401);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch (_) { return json({ error: 'JSON body expected' }, 400); }
  let token = '';
  try { token = await getSecret('SUPABASE_ACCESS_TOKEN'); } catch (_) { return json({ error: 'SUPABASE_ACCESS_TOKEN is not in the vault yet (Supabase account > Access tokens, then Vault > Add new secret).' }, 424); }
  const auth = { Authorization: 'Bearer ' + token };
  const action = String(body.action || '');

  if (action === 'list') {
    const r = await fetch(API + '/functions', { headers: auth });
    const t = await r.text();
    if (!r.ok) return json({ error: 'Management API ' + r.status + ': ' + t.slice(0, 300) }, 502);
    // deno-lint-ignore no-explicit-any
    const rows = (JSON.parse(t) as any[]).map(f => ({ slug: f.slug, version: f.version, verify_jwt: f.verify_jwt, updated_at: f.updated_at, status: f.status }));
    return json({ ok: true, functions: rows });
  }

  const name = String(body.name || '');
  if (!NAME.test(name)) return json({ error: 'name: lower-case letters, digits and dashes' }, 400);

  if (action === 'get') {
    const [meta, src] = await Promise.all([
      fetch(API + '/functions/' + name, { headers: auth }),
      fetch(API + '/functions/' + name + '/body', { headers: auth }),
    ]);
    if (!meta.ok) return json({ error: 'function ' + name + ': ' + meta.status + ' ' + (await meta.text()).slice(0, 200) }, meta.status === 404 ? 404 : 502);
    const m = await meta.json();
    if (!src.ok) return json({ error: 'body ' + name + ': ' + src.status + ' ' + (await src.text()).slice(0, 200) }, 502);
    const ctype = src.headers.get('Content-Type') || '';
    // the body comes back as the deployed eszip bundle (binary): hand it over base64, the build extracts index.ts
    const bytes = new Uint8Array(await src.arrayBuffer());
    let b64 = '';
    for (let i = 0; i < bytes.length; i += 0x8000) b64 += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
    b64 = btoa(b64);
    return json({ ok: true, name, version: m.version, verify_jwt: m.verify_jwt, entrypoint_path: m.entrypoint_path, content_type: ctype, bytes: bytes.length, bundle_b64: b64 });
  }

  if (action === 'deploy') {
    const source = typeof body.source === 'string' ? body.source : '';
    if (source.length < 40) return json({ error: 'source missing' }, 400);
    let verify = body.verify_jwt;
    if (typeof verify !== 'boolean') {
      const meta = await fetch(API + '/functions/' + name, { headers: auth });
      verify = meta.ok ? (await meta.json()).verify_jwt !== false : true;
    }
    const form = new FormData();
    form.append('metadata', JSON.stringify({ name, entrypoint_path: 'index.ts', verify_jwt: verify }));
    form.append('file', new Blob([source], { type: 'application/typescript' }), 'index.ts');
    const r = await fetch(API + '/functions/deploy?slug=' + name, { method: 'POST', headers: auth, body: form });
    const t = await r.text();
    if (!r.ok) return json({ error: 'deploy ' + name + ': ' + r.status + ' ' + t.slice(0, 500) }, 502);
    const out = JSON.parse(t);
    try { await svc.from('change_log').insert({ entity_type: 'edge_function', entity_id: name, field: 'version', old_value: null, new_value: String(out.version), changed_by: 'build (fn-deploy)' }); } catch (_) { /* audit */ }
    return json({ ok: true, name, version: out.version, verify_jwt: out.verify_jwt, sha: out.ezbr_sha256 });
  }
  return json({ error: 'unknown action' }, 400);
});
