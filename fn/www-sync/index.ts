// Welfare Avenue: www-sync (v2, 01/10/26, www3; v1 28/09/26, wave162)
// Deploys the public website (the new welfareavenue.com, built by build/www/make.py) from the www_files table to its
// own Netlify site, separate from the Hub's (host-sync). Text files are stored as they are, images as base64
// (encoding 'base64'); files with several parts are joined in part order. Netlify's digest deploy uploads only what
// changed. The first call creates the site (body.create = true, body.names = names to try in order) and records it in
// app_config (www_netlify_site_id, www_preview_url). Actions: deploy (default), status, and since v2 domain and ssl.
// v2 (www3, Steel 01/10/26: "change george's website with the new one"): domain attaches welfareavenue.com (primary)
// and www.welfareavenue.com (alias) to the site; nothing else is accepted. It changes nothing for visitors by itself:
// the domain only reaches this site once its DNS records at Namecheap point here (A or ALIAS @, CNAME www). ssl reads
// the certificate's state, or with provision: true asks Netlify for the Let's Encrypt certificate (it succeeds only once
// the DNS points here). Auth: the internal trigger secret only.
import { createClient } from 'jsr:@supabase/supabase-js@2';
const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const API = 'https://api.netlify.com/api/v1';
const DOMAINS = ['welfareavenue.com', 'www.welfareavenue.com'];

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret unavailable');
  return data as string;
}
async function cfg(key: string): Promise<string> {
  const { data } = await svc.from('app_config').select('value').eq('key', key).maybeSingle();
  return (data && data.value) || '';
}
async function setCfg(key: string, value: string) {
  await svc.from('app_config').upsert({ key, value, updated_at: new Date().toISOString() });
}
async function audit(entity: string, field: string, value: string) {
  try { await svc.from('change_log').insert({ entity_type: 'www_domain', entity_id: entity, field, old_value: null, new_value: value.slice(0, 500), changed_by: 'www-sync v2' }); } catch (_) { /* audit only */ }
}
function json(o: unknown, status = 200) { return new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } }); }
function b64(s: string): Uint8Array { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
async function sha1(bytes: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  const given = req.headers.get('x-wa-secret');
  let expected = '';
  try { expected = await getSecret('WA_TRIGGER_SECRET'); } catch (_) { /* no-op */ }
  if (!given || given !== expected) return new Response('unauthorized', { status: 401 });
  const body = await req.json().catch(() => ({}));
  const action = body.action || 'deploy';
  let token = '';
  try { token = await getSecret('NETLIFY_TOKEN'); } catch (_) { return json({ error: 'no NETLIFY_TOKEN configured' }, 500); }
  const H: Record<string, string> = { Authorization: 'Bearer ' + token };
  let siteId = await cfg('www_netlify_site_id');

  if (action === 'status') {
    if (!siteId) return json({ site: null });
    const r = await fetch(API + '/sites/' + siteId, { headers: H });
    if (!r.ok) return json({ error: 'site read failed: ' + r.status }, 502);
    const s = await r.json();
    return json({ site: { id: s.id, name: s.name, url: s.ssl_url || s.url, custom_domain: s.custom_domain, domain_aliases: s.domain_aliases, ssl: s.ssl, force_ssl: s.force_ssl,
      published_deploy: s.published_deploy && { id: s.published_deploy.id, state: s.published_deploy.state, created_at: s.published_deploy.created_at } } });
  }
  if (action === 'domain') {
    if (!siteId) return json({ error: 'no website site yet' }, 400);
    const domain = String(body.domain || '');
    const aliases: string[] = Array.isArray(body.aliases) ? body.aliases.map((x: unknown) => String(x)) : [];
    if (!DOMAINS.includes(domain) || !aliases.every(a => DOMAINS.includes(a) && a !== domain)) return json({ error: 'only welfareavenue.com and www.welfareavenue.com' }, 400);
    const r = await fetch(API + '/sites/' + siteId, { method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ custom_domain: domain, domain_aliases: aliases }) });
    const t = await r.text();
    if (!r.ok) { await audit(siteId, 'domain_failed', r.status + ' ' + t.slice(0, 300)); return json({ error: 'domain set failed: ' + r.status + ' ' + t.slice(0, 300) }, 502); }
    let s: Record<string, unknown> = {}; try { s = JSON.parse(t); } catch (_) { /* keep empty */ }
    await audit(siteId, 'custom_domain', domain + ' + ' + aliases.join(','));
    return json({ ok: true, site: { custom_domain: s.custom_domain, domain_aliases: s.domain_aliases, ssl: s.ssl, ssl_url: s.ssl_url, url: s.url } });
  }
  if (action === 'ssl') {
    if (!siteId) return json({ error: 'no website site yet' }, 400);
    const provision = body.provision === true;
    const r = await fetch(API + '/sites/' + siteId + '/ssl', { method: provision ? 'POST' : 'GET', headers: H });
    const t = await r.text();
    if (provision) await audit(siteId, 'ssl_provision', r.status + ' ' + t.slice(0, 300));
    let parsed: unknown = null; try { parsed = JSON.parse(t); } catch (_) { parsed = t.slice(0, 600); }
    return json({ ok: r.ok, status: r.status, ssl: parsed }, r.ok ? 200 : 502);
  }
  if (action !== 'deploy') return json({ error: 'unknown action' }, 400);

  let created = false;
  if (!siteId) {
    if (!body.create) return json({ error: 'no website site yet: call with create: true' }, 400);
    const names: string[] = Array.isArray(body.names) && body.names.length ? body.names : ['welfareavenue-www'];
    for (const name of names) {
      if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(name)) continue;
      const r = await fetch(API + '/sites', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      if (r.ok) {
        const s = await r.json(); siteId = s.id; created = true;
        await setCfg('www_netlify_site_id', s.id); await setCfg('www_preview_url', s.ssl_url || s.url || ('https://' + name + '.netlify.app'));
        break;
      }
      if (r.status !== 422) return json({ error: 'site create failed: ' + r.status + ' ' + (await r.text()).slice(0, 200) }, 502);
    }
    if (!siteId) return json({ error: 'every name was taken', names }, 409);
  }

  const { data, error } = await svc.from('www_files').select('path, part, content, encoding').order('path', { ascending: true }).order('part', { ascending: true });
  if (error || !data || !data.length) return json({ error: 'website files missing' }, 500);
  const parts: Record<string, { enc: string; chunks: string[] }> = {};
  for (const r of data as Array<{ path: string; part: number; content: string; encoding: string }>) {
    (parts[r.path] = parts[r.path] || { enc: r.encoding || 'utf8', chunks: [] }).chunks.push(r.content);
  }
  const files: Record<string, { sha: string; bytes: Uint8Array }> = {};
  const digests: Record<string, string> = {};
  for (const p of Object.keys(parts)) {
    const joined = parts[p].chunks.join('');
    const bytes = parts[p].enc === 'base64' ? b64(joined) : new TextEncoder().encode(joined);
    const sha = await sha1(bytes);
    files['/' + p] = { sha, bytes }; digests['/' + p] = sha;
  }
  if (!files['/index.html']) return json({ error: 'index.html missing' }, 500);

  const dep = await fetch(API + '/sites/' + siteId + '/deploys', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ files: digests }) });
  if (!dep.ok) return json({ error: 'deploy create failed: ' + dep.status + ' ' + (await dep.text()).slice(0, 200) }, 502);
  const dj = await dep.json();
  const deployId = dj.id; const required = new Set((dj.required || []) as string[]);
  const todo = Object.keys(files).filter(p => required.has(files[p].sha));
  let uploaded = 0;
  for (let i = 0; i < todo.length; i += 6) {
    const batch = todo.slice(i, i + 6);
    const res = await Promise.all(batch.map(p => fetch(API + '/deploys/' + deployId + '/files' + p, { method: 'PUT', headers: { ...H, 'Content-Type': 'application/octet-stream' }, body: files[p].bytes })));
    for (let j = 0; j < res.length; j++) {
      if (!res[j].ok) return json({ error: 'upload failed for ' + batch[j] + ': ' + res[j].status, deploy_id: deployId }, 502);
      uploaded++;
    }
  }
  let state = dj.state || 'unknown', url = '';
  for (let i = 0; i < 16; i++) {
    await new Promise(r => setTimeout(r, 1500));
    const st = await fetch(API + '/deploys/' + deployId, { headers: H });
    if (!st.ok) break;
    const js = await st.json(); state = js.state; url = js.ssl_url || js.url || '';
    if (state === 'ready' || state === 'error') break;
  }
  const site = await cfg('www_preview_url');
  try {
    await svc.from('change_log').insert({ entity_type: 'www_deploy', entity_id: String(deployId), field: 'published', old_value: null,
      new_value: 'files=' + Object.keys(files).length + ' uploaded=' + uploaded + ' state=' + state + (created ? ' site created' : ''), changed_by: 'www-sync v2' });
  } catch (_) { /* audit only */ }
  return json({ ok: state === 'ready', site_id: siteId, site, created, deploy_id: deployId, state, files: Object.keys(files).length, uploaded, deploy_url: url });
});
