// Welfare Avenue: host-sync (v14, 12/10/26)
// v14 (wave231): also deploys platform verification files at the site root: every site_files path that looks like
// tiktok<letters and digits>.txt (TikTok for Developers' "Verify URL prefix" file for https://hub.welfareavenue.com/).
// They are plain text, one row each; add or remove the row and run host-sync.
// v13 (wave225): also deploys the link-in-bio page /links/index.html (served for /links by _redirects; /l/<code> is proxied to
// the go function there too).
// v12 (wave219): also deploys what makes the Hub an app with notifications: /manifest.webmanifest, the service worker /sw.js
// (notifications only: no caching, no fetch handler) and the icons under /icons/ (PNG files kept in site_files as base64 text;
// every path ending in .png is decoded before upload).
// v11: also deploys the "still interested" page /i/index.html (served for every /i/<token> by _redirects; the texts to
// people who applied for a team role through CABM carry those links, see candidate-confirm).
// v10 (wave175b): also deploys the privacy notice /privacy/index.html (Google's sign-in screen links to it).
// v9 (wave175): also deploys the volunteer account page /me/index.html (served for /me and /me/* by _redirects).
// v8 (wave171): also deploys the volunteer confirm page /c/index.html (served for every /c/<token> by _redirects).
// v7 (wave161c, wave162): also deploys give/embed.js and give/embed.css, the donation popup the website loads (site_files
// paths 'give/embed.js' and 'give/embed.css'; real files, so the /give/* rewrite does not touch them).
// v6 (wave161): also deploys the public donation page /give/index.html (served for /give and every /give/<path> by the
// _redirects rules), read from site_files path 'give/index.html' when it exists.
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
  // v5: the public form page and the rewrite that serves it for every /f/<slug>; v6: the donation page; v11: the still-interested page;
  // v12: the app manifest, the service worker and the icons (the .png files are base64 in site_files)
  for (const extra of ['f/index.html', 'c/index.html', 'me/index.html', 'privacy/index.html', 'i/index.html', 'give/index.html', 'give/embed.js', 'give/embed.css', 'links/index.html', '_redirects',
    'manifest.webmanifest', 'sw.js', 'icons/hub-192.png', 'icons/hub-512.png', 'icons/hub-maskable-512.png', 'icons/hub-badge-96.png', 'icons/apple-touch-180.png']) {
    try {
      const { data: ex } = await svc.from('site_files').select('part, content').eq('path', extra).order('part', { ascending: true });
      if (ex && ex.length) {
        const text = ex.map((r: { content: string }) => r.content).join('');
        deployFiles['/' + extra] = /\.png$/.test(extra) ? Uint8Array.from(atob(text.replace(/\s+/g, '')), c => c.charCodeAt(0)) : new TextEncoder().encode(text);
      }
    } catch (_) { /* optional */ }
  }

  // v14: platform verification files at the root (tiktok<id>.txt), one plain-text row each
  try {
    const { data: vf } = await svc.from('site_files').select('path, part, content').like('path', 'tiktok%').order('part', { ascending: true });
    for (const r of (vf || []) as Array<{ path: string; content: string }>) {
      if (!/^tiktok[A-Za-z0-9]{8,80}\.txt$/.test(r.path)) continue;
      const prev = deployFiles['/' + r.path] ? new TextDecoder().decode(deployFiles['/' + r.path]) : '';
      deployFiles['/' + r.path] = new TextEncoder().encode(prev + r.content);
    }
  } catch (_) { /* optional */ }

  const netlify = await netlifyDeploy(deployFiles);

  try {
    await svc.from('change_log').insert({
      entity_type: 'site_deploy', entity_id: String(netlify.deploy_id || 'storage-only'), field: 'published',
      old_value: null, new_value: 'bytes=' + html.length + ' files=' + Object.keys(deployFiles).length + ' storage=' + (storageOk ? 'ok' : 'fail') + ' netlify=' + (netlify.state || netlify.error || netlify.skipped || 'n/a'),
      changed_by: 'host-sync v14'
    });
  } catch (_) { /* audit only */ }

  return new Response(JSON.stringify({ ok: storageOk, bucket, path, bytes: html.length, files: Object.keys(deployFiles), netlify }), { headers: { 'Content-Type': 'application/json' } });
});
