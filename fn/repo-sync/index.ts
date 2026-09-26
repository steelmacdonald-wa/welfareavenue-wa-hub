// Welfare Avenue: repo-sync (v1, 24/09/26)
// Pushes hub source files to GitHub through the Git Data API using the vault
// GITHUB_TOKEN (fine-grained PAT, Contents read/write on the hub repo). Lives
// here because the build sandbox cannot talk to GitHub with its own
// credentials; Supabase can. Auth: x-wa-secret (WA_TRIGGER_SECRET) only (since 26/09/26).
// Actions:
//   {action:'probe'}                       token identity + repositories it can reach
//   {action:'blobs', repo, files:[{path, content_b64}]}  create blobs, returns [{path, sha}]
//   {action:'commit', repo, branch, message, entries:[{path, sha, mode?}], deletes:[path]}
//                                          one commit on top of the branch head (or the first commit)
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
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
async function staffEmail(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  return email.endsWith('@welfareavenue.com') || email === 'steelmacdonald@gmail.com' ? email : null;
}

const API = 'https://api.github.com';
async function gh(token: string, method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; body: any }> {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', 'User-Agent': 'wa-hub-repo-sync' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let b: any = null;
  try { b = await res.json(); } catch (_) { b = null; }
  return { ok: res.ok, status: res.status, body: b };
}
function repoPath(repo: string): string {
  const r = String(repo || '').replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, '');
  if (!/^[\w.-]+\/[\w.-]+$/.test(r)) throw new Error('repo must be owner/name');
  return r;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  /* audit 26/09/26: the build pipeline only (the trigger secret); a staff sign-in no longer reaches GitHub */
  let caller: string | null = null;
  try { const g = req.headers.get('x-wa-secret'); if (g && g === (await getSecret('WA_TRIGGER_SECRET'))) caller = 'automation'; } catch (_) { /* no */ }
  if (!caller) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || 'probe');
  try {
    const token = await getSecret('GITHUB_TOKEN');
    if (action === 'probe') {
      const me = await gh(token, 'GET', '/user');
      const repos = await gh(token, 'GET', '/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member');
      let repoInfo: unknown = null;
      if (body.repo) { const r = await gh(token, 'GET', '/repos/' + repoPath(body.repo)); repoInfo = r.ok ? { full_name: r.body.full_name, private: r.body.private, default_branch: r.body.default_branch, permissions: r.body.permissions } : { status: r.status, error: r.body && r.body.message }; }
      return json({
        token_user: me.ok ? me.body.login : null, token_status: me.status,
        repos: repos.ok && Array.isArray(repos.body) ? repos.body.map((r: any) => ({ full_name: r.full_name, private: r.private, default_branch: r.default_branch, pushed_at: r.pushed_at, push: r.permissions && r.permissions.push })) : { status: repos.status, error: repos.body && repos.body.message },
        repo: repoInfo
      });
    }
    if (action === 'tree') {
      /* the branch head and every path with its blob sha, so the build can pull what changed elsewhere */
      const repo = repoPath(body.repo);
      const branch = String(body.branch || 'main');
      const ref = await gh(token, 'GET', '/repos/' + repo + '/git/ref/heads/' + encodeURIComponent(branch));
      if (!ref.ok) return json({ error: 'branch ' + branch + ' not found' }, 404);
      const headSha = ref.body.object.sha as string;
      const commit = await gh(token, 'GET', '/repos/' + repo + '/git/commits/' + headSha);
      const tree = await gh(token, 'GET', '/repos/' + repo + '/git/trees/' + (commit.ok ? commit.body.tree.sha : headSha) + '?recursive=1');
      if (!tree.ok) return json({ error: 'tree unavailable' }, 502);
      // deno-lint-ignore no-explicit-any
      const files = ((tree.body.tree || []) as any[]).filter(t => t.type === 'blob').map(t => ({ path: t.path, sha: t.sha, size: t.size }));
      return json({ head: headSha, message: commit.ok ? commit.body.message : null, date: commit.ok ? commit.body.committer?.date : null, truncated: !!tree.body.truncated, files });
    }
    if (action === 'get') {
      /* one blob, base64, by sha (any size up to GitHub's 100 MB) */
      const repo = repoPath(body.repo);
      const sha = String(body.sha || '');
      if (!/^[0-9a-f]{40}$/.test(sha)) return json({ error: 'sha required' }, 400);
      const r = await gh(token, 'GET', '/repos/' + repo + '/git/blobs/' + sha);
      if (!r.ok) return json({ error: 'blob ' + r.status }, 502);
      return json({ sha, encoding: r.body.encoding, content_b64: String(r.body.content || '').replace(/\n/g, '') });
    }
    if (action === 'blobs') {
      const repo = repoPath(body.repo);
      const files = Array.isArray(body.files) ? body.files : [];
      const out: Array<{ path: string; sha: string }> = [];
      const errors: Array<{ path: string; error: string }> = [];
      for (let i = 0; i < files.length; i += 6) {
        const batch = files.slice(i, i + 6);
        const results = await Promise.all(batch.map(async (f: { path: string; content_b64: string }) => {
          const r = await gh(token, 'POST', '/repos/' + repo + '/git/blobs', { content: f.content_b64, encoding: 'base64' });
          return r.ok ? { path: f.path, sha: r.body.sha as string } : { path: f.path, error: String(r.status) + ' ' + ((r.body && r.body.message) || '') };
        }));
        results.forEach((r: any) => { if (r.sha) out.push(r); else errors.push(r); });
      }
      return json({ blobs: out, errors });
    }
    if (action === 'commit') {
      const repo = repoPath(body.repo);
      const branch = String(body.branch || 'main');
      const message = String(body.message || 'hub update');
      const entries = Array.isArray(body.entries) ? body.entries : [];
      const deletes = Array.isArray(body.deletes) ? body.deletes : [];
      const ref = await gh(token, 'GET', '/repos/' + repo + '/git/ref/heads/' + encodeURIComponent(branch));
      let parentSha: string | null = null, baseTree: string | null = null;
      if (ref.ok) {
        parentSha = ref.body.object.sha;
        const c = await gh(token, 'GET', '/repos/' + repo + '/git/commits/' + parentSha);
        if (!c.ok) throw new Error('read head commit failed: ' + c.status);
        baseTree = c.body.tree.sha;
      } else if (ref.status !== 404 && ref.status !== 409) {
        throw new Error('read ref failed: ' + ref.status + ' ' + ((ref.body && ref.body.message) || ''));
      }
      const tree: Array<Record<string, unknown>> = entries.map((e: { path: string; sha: string; mode?: string }) => ({ path: e.path, mode: e.mode || '100644', type: 'blob', sha: e.sha }));
      if (baseTree) deletes.forEach((p: string) => tree.push({ path: p, mode: '100644', type: 'blob', sha: null }));
      const treeBody: Record<string, unknown> = { tree };
      if (baseTree) treeBody.base_tree = baseTree;
      const t = await gh(token, 'POST', '/repos/' + repo + '/git/trees', treeBody);
      if (!t.ok) throw new Error('tree failed: ' + t.status + ' ' + ((t.body && t.body.message) || ''));
      const author = { name: String(body.author_name || 'Steel MacDonald'), email: String(body.author_email || 'steel.macdonald@welfareavenue.com') };
      const cm = await gh(token, 'POST', '/repos/' + repo + '/git/commits', { message, tree: t.body.sha, parents: parentSha ? [parentSha] : [], author, committer: author });
      if (!cm.ok) throw new Error('commit failed: ' + cm.status + ' ' + ((cm.body && cm.body.message) || ''));
      let up;
      if (parentSha) up = await gh(token, 'PATCH', '/repos/' + repo + '/git/refs/heads/' + encodeURIComponent(branch), { sha: cm.body.sha, force: false });
      else up = await gh(token, 'POST', '/repos/' + repo + '/git/refs', { ref: 'refs/heads/' + branch, sha: cm.body.sha });
      if (!up.ok) throw new Error('ref update failed: ' + up.status + ' ' + ((up.body && up.body.message) || ''));
      try {
        await svc.from('change_log').insert({ entity_type: 'repo_sync', entity_id: repo, field: 'pushed', old_value: parentSha, new_value: cm.body.sha + ' ' + message.slice(0, 120), changed_by: caller });
        await svc.from('app_config').upsert({ key: 'github_repo', value: repo, updated_at: new Date().toISOString() });
      } catch (_) { /* audit */ }
      return json({ commit: cm.body.sha, url: 'https://github.com/' + repo + '/commit/' + cm.body.sha, branch, files: entries.length, deletes: deletes.length, first_commit: !parentSha });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String(e).slice(0, 400) }, 500);
  }
});
