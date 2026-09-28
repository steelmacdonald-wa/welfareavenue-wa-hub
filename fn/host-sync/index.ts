// Welfare Avenue: host-sync (v5, 28/09/26)
// v5 (wave156): also deploys the public form page /f/index.html and /_redirects (every /f/<slug> is served by that
// page), read from site_files paths 'f/index.html' and '_redirects' when they exist.
// v3 + Phase 2 (S2): also deploys a /_headers file (security headers: CSP,
// HSTS, frame-deny, referrer policy) read from site_files path '_headers'.
// Assembles the site from the site_files table, publishes it into the
// storage bucket (backup copy), and deploys to Netlify via digest method
// using the NETLIFY_TOKEN vault secret. Auth: internal trigger secret only.
import { createClient } from 'jsr:@supabase/supabase-js@2';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret unavailable');
  return data as string;
}
async function getSecretSafe(name: string): Promise<string | null> {
  try { return await getSecret(name); } catch (_) { return null; }
}

async function sha1(bytes: Uint8Array): Promise<string> {
  const hashBuf = await crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function netlifyDeploy(files: Record<string, Uint8Array>): Promise<Record<string, unknown>> {
  const token = await getSecretSafe('NETLIFY_TOKEN');
  if (!token) return { skipped: 'no NETLIFY_TOKEN configured' };
  const H: Record<string, string> = { Authorization: 'Bearer ' + token };

  let siteId = '';
  const { data: cfg } = await svc.from('app_config').select('value').eq('key', 'netlify_site_id').maybeSingle();
  siteId = (cfg && cfg.value) || '';
  if (!siteId) {
    const { data: surl } = await svc.from('app_config').select('value').eq('key', 'site_url').maybeSingle();
    let host = '';
    try { host = new URL((surl && surl.value) || '').hostname.split('.')[0]; } catch (_) { /* fall through */ }
    const res = await fetch('https://api.netlify.com/api/v1/sites', { headers: H });
    if (!res.ok) return { error: 'sites list failed: ' + res.status + ' ' + (await res.text()).slice(0, 200) };
    const sites = (await res.json()) as Array<{ id: string; name: string; url: string }>;
    const hit = sites.find(s => s.name === host) || sites.find(s => (s.url || '').indexOf(host) >= 0) || (sites.length === 1 ? sites[0] : null);
    if (!hit) return { error: 'netlify site not found for host ' + host + ' among ' + sites.length + ' sites' };
    siteId = hit.id;
    await svc.from('app_config').upsert({ key: 'netlify_site_id', value: siteId, updated_at: new Date().toISOString() });
  }

  const digests: Record<string, string> = {};
  const byPath: Record<string, { sha: string; bytes: Uint8Array }> = {};
  for (const p of Object.keys(files)) {
    const sha = await sha1(files[p]);
    digests[p] = sha;
    byPath[p] = { sha, bytes: files[p] };
  }

  const dep = await fetch('https://api.netlify.com/api/v1/sites/' + siteId + '/deploys', {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: digests })
  });
  if (!dep.ok) return { error: 'deploy create failed: ' + dep.status + ' ' + (await dep.text()).slice(0, 200) };
  const depJson = await dep.json();
  const deployId = depJson.id;
  const required = (depJson.required || []) as string[];
  let uploaded = 0;
  for (const p of Object.keys(byPath)) {
    if (required.indexOf(byPath[p].sha) < 0) continue;
    const up = await fetch('https://api.netlify.com/api/v1/deploys/' + deployId + '/files' + p, {
      method: 'PUT',
      headers: { ...H, 'Content-Type': 'application/octet-stream' },
      body: byPath[p].bytes
    });
    if (!up.ok) return { error: 'file upload failed for ' + p + ': ' + up.status + ' ' + (await up.text()).slice(0, 200), deploy_id: deployId };
    uploaded++;
  }
  let state = depJson.state || 'unknown';
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 1500));
    const st = await fetch('https://api.netlify.com/api/v1/deploys/' + deployId, { headers: H });
    if (!st.ok) break;
    const js = await st.json();
    state = js.state;
    if (state === 'ready' || state === 'error') break;
  }
  return { deploy_id: deployId, state, uploaded };
}

Deno.serve(async (req: Request) => {
  const given = req.headers.get('x-wa-secret');
  let expected = '';
  try { expected = await getSecret('WA_TRIGGER_SECRET'); } catch (_) { /* no-op */ }
  if (!given || given !== expected) return new Response('unauthorized', { status: 401 });
  const body = await req.json().catch(() => ({}));
  const bucket = body.bucket || 'web';
  const path = body.path || 'index.html';
  if (!/^[\w.-]+$/.test(path) || !/^[\w-]+$/.test(bucket)) return new Response('bad path', { status: 400 });
  const { data, error } = await svc.from('site_files').select('part, content').eq('path', 'index.html').order('part', { ascending: true });
  if (error || !data || !data.length) return new Response('site content missing', { status: 500 });
  const html = data.map((r: { content: string }) => r.content).join('');

  const up = await svc.storage.from(bucket).upload(path, new TextEncoder().encode(html), { contentType: 'text/html; charset=utf-8', upsert: true });
  const storageOk = !up.error;

  const deployFiles: Record<string, Uint8Array> = { '/index.html': new TextEncoder().encode(html) };
  try {
    const { data: hd } = await svc.from('site_files').select('part, content').eq('path', '_headers').order('part', { ascending: true });
    if (hd && hd.length) deployFiles['/_headers'] = new TextEncoder().encode(hd.map((r: { content: string }) => r.content).join(''));
  } catch (_) { /* headers optional */ }
  // v5: the public form page and the rewrite that serves it for every /f/<slug>
  for (const extra of ['f/index.html', '_redirects']) {
    try {
      const { data: ex } = await svc.from('site_files').select('part, content').eq('path', extra).order('part', { ascending: true });
      if (ex && ex.length) deployFiles['/' + extra] = new TextEncoder().encode(ex.map((r: { content: string }) => r.content).join(''));
    } catch (_) { /* optional */ }
  }

  const netlify = await netlifyDeploy(deployFiles);

  try {
    await svc.from('change_log').insert({
      entity_type: 'site_deploy', entity_id: String(netlify.deploy_id || 'storage-only'), field: 'published',
      old_value: null, new_value: 'bytes=' + html.length + ' files=' + Object.keys(deployFiles).length + ' storage=' + (storageOk ? 'ok' : 'fail') + ' netlify=' + (netlify.state || netlify.error || netlify.skipped || 'n/a'),
      changed_by: 'host-sync v5'
    });
  } catch (_) { /* audit only */ }

  return new Response(JSON.stringify({ ok: storageOk, bucket, path, bytes: html.length, files: Object.keys(deployFiles), netlify }), { headers: { 'Content-Type': 'application/json' } });
});
