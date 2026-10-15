// Welfare Avenue: loom-pull (v3, 14/10/26, wave237; v2.1 29/09/26, wave165; v1 28/09/26, wave162)
// v3: pull one recording on demand. Steel (14/10/26): "we should only be reading from Loom, not Read AI or Otter AI". Loom's
// recap email used to be filed as a meeting of its own (and processed into tasks) while the pull filed the real transcript two
// days later, so every team meeting made its tasks twice. Now mail-pull v11 hands the recap email's Loom id to this function
// ({action: 'pull', loom_id, why}) and files nothing itself: the recording is fetched, classified and filed by the same rules as
// the scheduled sync (team meeting, leadership, one-on-one, needs a look, waiting for Loom's transcript), so a meeting reaches
// the Hub within the half hour, from its full transcript, once. The scheduled sync (every half hour through the day since wave237)
// stays the safety net for recordings with no recap email and for ones that were still waiting.
// v2.1: Loom's transcript does not always name every voice, so a one-on-one's people are the speakers Loom names, plus the names
// its title joins (Suhaib / Steel), plus, when that still leaves one person, the people Loom lists on the meeting (not its recorder).
// v2: Steel (29/09/26): "pull all these in, including July and August but don't create any tasks from them just enhance the
// "Ask the Hub". 1on1s should be confidential and not searchable by anyone except for those that are speaking in the meeting.
// Loom gives you those that are speaking in the meeting." A one-on-one (1on1, 1:1, one-on-one, or names joined by /, x, & or +,
// four speakers at most) is filed for the people speaking in it and nobody else (visibility speakers: their names and emails;
// no admin, leader or director sees it), before the sensitive check (nobody else reads it anyway). New action backfill
// {items: [{id, department, visibility}], dry_run?}: the chosen older recordings become archive-only transcripts (never processed
// into tasks) with a summary for Ask the Hub (llm task transcript_archive). Team meetings named in the plural or in French
// (Operations Meetings, Human ressources meeting) are recognised; Finance's meetings and money words go to Finance.
// Steel (28/09/26): "I want to make sure that the hub pulls from loom automatically every monday, wednesday, and friday without
// the need for claude to be open", and "loom now has abilities to pull transcripts via mcps. It's a native solution to rely on".
// Reads Loom through the Atlassian Rovo MCP server (v2, https://mcp.atlassian.com/v2/mcp) as hub@welfareavenue.com, the Atlassian account
// that runs the Welfare Avenue Loom workspace and records the meetings (site welfareavenue-29450069, its cloud id in loom_cloud_id), with a
// key from Atlassian's approval (wave162c: Connect Loom on the Loom card, loom-connect; a refresh token in the vault, renewed here
// and sent as a Bearer token), or else a scoped API token for Atlassian MCP V2 (read:loom:agent-interface) kept as the Edge
// Function secrets ATLASSIAN_EMAIL and ATLASSIAN_API_TOKEN, sent as Basic auth (Atlassian refused it for the site on 28/09/26). It only ever calls read tools (get..., list...,
// search..., fetch...): callTool refuses anything that could write, share, move, rename or delete.
// Actions (POST {action}):
//   status : whether the key is set and the last runs (admins or x-wa-secret)
//   probe  : a read-only look at what Loom sends (the tools and their inputs, the Atlassian sites, one page of recordings, one
//            transcript's shape with the text cut short); nothing is written (admins or x-wa-secret)
//   sync   : the new recordings since loom_pull_since become transcripts (the schedule, Monday, Wednesday and Friday at 7:30 in
//            Toronto through call_edge; admins with Pull now). Runs in the background, one run at a time, at most loom_pull_max
//            recordings and about 100 seconds per run; the rest waits for the next run.
//   file {loom_id, department, visibility}: an admin files a recording that needed a look (or was skipped); visibility speakers
//            files a one-on-one for the people speaking in it
//   backfill {items: [{id, department, visibility}], dry_run?, budget_ms?} (v2): older recordings become archive-only meetings
//            with a summary (Loom's notes and the transcript, llm task transcript_archive), within about 100 seconds a call;
//            the rest come back as 'later' (admins or x-wa-secret). A meeting given for everyone that may hold something
//            sensitive goes to the leaders instead; each answer names the speakers (roster names)
// Who sees a filed meeting (Steel, 28/09/26: "Team meetings to all, the rest private"):
//   - the recurring team meetings (weekly Operations, Fundraising, Marketing, Human resources, Program Development, Toronto
//     Operations) are visible to everyone, under their team;
//   - leadership meetings: department Leadership meeting, visibility leadership (the leaders, the board circle, the admins);
//   - everything else (one-on-ones, check-ins, interviews, onboarding, working sessions): confidential to the people in it who are
//     on the Hub (the speakers and the invitees Loom lists as collaborators, matched to the roster by name or email) plus the
//     leaders (the admins see everything anyway). Loom's own sharing setting is not used: the meeting recorder keeps every
//     recording to its owner by default, team meetings included;
//   - board meetings, meetings that may hold something sensitive, meetings shared by someone outside the team and meetings
//     whose team is unclear wait for an admin (needs a look); one-person recordings are skipped (an admin can still file them);
//   - personal recordings (recovery and the like) are left out and nothing about them is kept but the id.
// A filed meeting goes through the normal pipeline (process-transcript and, for leadership, process-leadership): tasks,
// updates, decisions, mentions and the usual Slack line.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const TZ = 'America/Toronto';
const BUDGET_MS = 100000;
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type Json = Record<string, any>;

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}
async function vaultOnly(name: string): Promise<string> { try { return (await getSecret(name)).trim(); } catch (_) { return ''; } }
/* wave162c: the Loom connection through Atlassian's approval (loom-connect keeps a refresh token in the vault). Returns '' when
   there is none; renews the short-lived access token when it has less than two minutes left (the refresh token rotates). */
const TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
const RESOURCE = 'https://mcp.atlassian.com/v2/mcp';
async function oauthBearer(): Promise<string> {
  const refresh = await vaultOnly('LOOM_OAUTH_REFRESH');
  if (!refresh) return '';
  try { const c = JSON.parse((await vaultOnly('LOOM_OAUTH_ACCESS')) || '{}'); if (c.t && Number(c.exp) > Date.now() + 120000) return 'Bearer ' + c.t; } catch (_) { /* renew */ }
  let clientId = '';
  try { clientId = String(JSON.parse((await vaultOnly('LOOM_OAUTH_CLIENT')) || '{}').client_id || ''); } catch (_) { clientId = ''; }
  if (!clientId) throw new McpError('refused', 0, 'The Loom connection is missing its registration: an admin presses Connect Loom on the Loom card');
  const res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh, client_id: clientId, resource: RESOURCE }).toString() });
  const out = await res.json().catch(() => ({})) as Json;
  if (!res.ok || !out.access_token) {
    const why = String(out.error_description || out.error || res.status).slice(0, 160);
    throw new McpError(res.status >= 500 ? 'http' : 'refused', res.status, 'The Loom connection has lapsed (' + why + '): an admin presses Connect Loom on the Loom card');
  }
  const note = 'wave162c, renewed by loom-pull';
  if (out.refresh_token && out.refresh_token !== refresh) await svc.rpc('wa_vault_set', { p_name: 'LOOM_OAUTH_REFRESH', p_value: String(out.refresh_token), p_note: 'The lasting Loom key for the Loom pull (' + note + ').' });
  await svc.rpc('wa_vault_set', { p_name: 'LOOM_OAUTH_ACCESS', p_value: JSON.stringify({ t: String(out.access_token), exp: Date.now() + Math.max(60, Number(out.expires_in || 3600) - 60) * 1000 }), p_note: 'A short-lived Loom access token (' + note + ').' });
  return 'Bearer ' + String(out.access_token);
}
async function keyPart(name: string): Promise<string> {
  const env = (Deno.env.get(name) || '').trim();
  if (env) return env;
  try { return (await getSecret(name)).trim(); } catch (_) { return ''; }
}

/* ---------- who is calling: the schedule (x-wa-secret) or an admin ---------- */
async function caller(req: Request): Promise<{ kind: 'automation' | 'admin'; who: string } | null> {
  try { const s = req.headers.get('x-wa-secret'); if (s && s === (await getSecret('WA_TRIGGER_SECRET'))) return { kind: 'automation', who: 'automation' }; } catch (_) { /* no */ }
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  try { const r = await asUser.rpc('is_wa_admin'); if (r.data !== true) return null; } catch (_) { return null; }
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  if (!email) return null;
  let who = email;
  try { const { data: tm } = await svc.from('team_members').select('name').ilike('email', email).limit(1); if (tm && tm[0] && tm[0].name) who = String(tm[0].name); } catch (_) { /* the email will do */ }
  return { kind: 'admin', who };
}

/* =====================================================================================================================
   The MCP client (streamable HTTP: JSON or server-sent events, a session id after initialize)
   ===================================================================================================================== */
export class McpError extends Error {
  kind: string; status: number;
  constructor(kind: string, status: number, message: string) { super(message); this.kind = kind; this.status = status; }
}
export function sseMessages(text: string): Json[] {
  const out: Json[] = [];
  for (const block of String(text || '').replace(/\r\n?/g, '\n').split(/\n\n+/)) {
    const data = block.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).replace(/^ /, '')).join('\n');
    if (!data.trim()) continue;
    try { out.push(JSON.parse(data)); } catch (_) { /* not JSON */ }
  }
  return out;
}
export function pickMessage(text: string, contentType: string, id?: number): Json | null {
  if (/text\/event-stream/i.test(contentType)) {
    const msgs = sseMessages(text);
    return msgs.find((m) => id !== undefined && m.id === id) || msgs.filter((m) => 'result' in m || 'error' in m).pop() || null;
  }
  const t = String(text || '').trim();
  if (!t) return null;
  const j = JSON.parse(t);
  if (Array.isArray(j)) return j.find((m) => m && m.id === id) || j[0] || null;
  return j;
}
/* a tool the pull may call: reading only */
const WRITE_WORDS = new Set(['create', 'update', 'delete', 'remove', 'move', 'rename', 'share', 'unshare', 'add', 'post', 'upload', 'publish', 'react', 'set', 'restore', 'recover', 'archive', 'transfer', 'edit', 'write', 'invite', 'assign', 'comment', 'trash', 'duplicate', 'copy', 'merge', 'replace', 'reply', 'approve', 'complete', 'convert', 'enable', 'disable', 'link', 'send', 'submit', 'start', 'stop', 'cancel', 'close', 'open', 'import', 'export']);
/* a tool the pull may call: it starts with get, list, search, fetch or lookup and no word in its name changes anything */
export function readOnlyTool(name: string): boolean {
  if (name === 'atlassianUserInfo') return true;
  const words = String(name || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length || ['get', 'list', 'search', 'fetch', 'lookup'].indexOf(words[0]) < 0) return false;
  return !words.slice(1).some((w) => WRITE_WORDS.has(w));
}
export class Mcp {
  url: string; auth: string; sid = ''; proto = '2025-06-18'; n = 0; inited = false; server: Json = {};
  tools: Json[] = [];
  f: typeof fetch;
  constructor(url: string, auth: string, f?: typeof fetch) { this.url = url; this.auth = auth; this.f = f || fetch; }
  headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream', 'Authorization': this.auth };
    if (this.sid) h['Mcp-Session-Id'] = this.sid;
    if (this.inited) h['MCP-Protocol-Version'] = this.proto;
    return h;
  }
  async rpc(method: string, params?: Json, notify = false): Promise<Json> {
    const id = notify ? undefined : ++this.n;
    const body = notify ? { jsonrpc: '2.0', method, params: params || {} } : { jsonrpc: '2.0', id, method, params: params || {} };
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 45000);
    try {
      const res = await this.f(this.url, { method: 'POST', headers: this.headers(), body: JSON.stringify(body), signal: ctl.signal });
      const sid = res.headers.get('mcp-session-id');
      if (sid) this.sid = sid;
      const text = await res.text();
      if (res.status === 401 || res.status === 403) throw new McpError('refused', res.status, 'Atlassian refused the key (' + res.status + '): ' + text.replace(/\s+/g, ' ').slice(0, 200));
      if (notify) { if (!res.ok) throw new McpError('http', res.status, text.slice(0, 200)); return {}; }
      if (!res.ok) throw new McpError('http', res.status, 'Atlassian answered ' + res.status + ': ' + text.replace(/\s+/g, ' ').slice(0, 200));
      let msg: Json | null = null;
      try { msg = pickMessage(text, res.headers.get('content-type') || '', id); } catch (_) { msg = null; }
      if (!msg) throw new McpError('empty', res.status, 'Atlassian sent nothing readable for ' + method + ': ' + text.replace(/\s+/g, ' ').slice(0, 200));
      if (msg.error) throw new McpError('rpc', Number(msg.error.code) || 0, String(msg.error.message || JSON.stringify(msg.error)).slice(0, 300));
      return (msg.result || {}) as Json;
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw new McpError('timeout', 0, 'Atlassian did not answer ' + method + ' within 45 seconds');
      throw e;
    } finally { clearTimeout(timer); }
  }
  async init(): Promise<void> {
    const r = await this.rpc('initialize', { protocolVersion: this.proto, capabilities: {}, clientInfo: { name: 'welfare-avenue-hub-loom-pull', version: '1.0.0' } });
    if (r.protocolVersion) this.proto = String(r.protocolVersion);
    this.server = (r.serverInfo || {}) as Json;
    this.inited = true;
    try { await this.rpc('notifications/initialized', {}, true); } catch (e) { if (e instanceof McpError && e.kind === 'refused') throw e; }
  }
  async listTools(): Promise<Json[]> {
    const all: Json[] = []; let cursor: string | undefined;
    for (let i = 0; i < 10; i++) {
      const r = await this.rpc('tools/list', cursor ? { cursor } : {});
      all.push(...((r.tools || []) as Json[]));
      cursor = r.nextCursor ? String(r.nextCursor) : undefined;
      if (!cursor) break;
    }
    this.tools = all;
    return all;
  }
  tool(re: RegExp): Json | null { return this.tools.find((t) => re.test(String(t.name))) || null; }
  async call(name: string, args: Json): Promise<unknown> {
    if (!readOnlyTool(name)) throw new Error('The Loom pull only reads; it will not call ' + name);
    const r = await this.rpc('tools/call', { name, arguments: args });
    return toolData(r);
  }
}

/* ---------- reading tool results ---------- */
function tryJson(s: string): unknown { try { return JSON.parse(s); } catch (_) { return undefined; } }
export function toolData(r: Json): unknown {
  const parts = Array.isArray(r.content) ? r.content as Json[] : [];
  const texts = parts.map((p) => p && p.type === 'text' ? String(p.text || '') : (p && p.type === 'resource' && p.resource && typeof p.resource.text === 'string' ? String(p.resource.text) : '')).filter((t) => t !== '');
  if (r.isError) throw new McpError('tool', 0, 'Loom said: ' + (texts.join(' ') || JSON.stringify(r.structuredContent || {})).replace(/\s+/g, ' ').slice(0, 300));
  if (r.structuredContent !== undefined && r.structuredContent !== null) return r.structuredContent;
  if (texts.length === 1) { const j = tryJson(texts[0]); return j !== undefined ? j : texts[0]; }
  if (texts.length > 1) { const js = texts.map(tryJson); if (js.every((x) => x !== undefined)) return js; return texts.join('\n'); }
  return r;
}
function walkPath(x: unknown, fn: (v: unknown, path: string[]) => void, path: string[] = [], depth = 0): void {
  if (depth > 8 || x === null || x === undefined) return;
  fn(x, path);
  if (Array.isArray(x)) { for (const v of x) walkPath(v, fn, path, depth + 1); return; }
  if (typeof x === 'object') for (const [k, v] of Object.entries(x as Json)) walkPath(v, fn, path.concat(k), depth + 1);
}
function walk(x: unknown, fn: (v: unknown, key: string) => void, key = '', depth = 0): void {
  if (depth > 8 || x === null || x === undefined) return;
  fn(x, key);
  if (Array.isArray(x)) { for (const v of x) walk(v, fn, key, depth + 1); return; }
  if (typeof x === 'object') for (const [k, v] of Object.entries(x as Json)) walk(v, fn, k, depth + 1);
}
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : (typeof v === 'number' ? String(v) : ''));
const num = (v: unknown): number | null => { const n = typeof v === 'number' ? v : (typeof v === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(v) ? Number(v) : NaN); return Number.isFinite(n) ? n : null; };

/* ---------- the schema-led arguments (the probe shows the real names; these cover the usual spellings) ---------- */
function propsOf(t: Json | null): Json { return (t && t.inputSchema && t.inputSchema.properties) || {}; }
export function argsFor(t: Json | null, want: { cloudId?: string; videoId?: string; ari?: string; cursor?: string; limit?: number; offset?: number; from?: string; format?: string; transcript?: boolean }): Json {
  const p = propsOf(t); const keys = Object.keys(p); const a: Json = {};
  const find = (re: RegExp) => keys.find((k) => re.test(k));
  const cid = find(/^cloud_?id$/i);
  if (cid && want.cloudId) a[cid] = want.cloudId;
  if (want.videoId) {
    const ka = find(/^(video_?ari|ari)$/i);
    const k = find(/^(video_?id|loom_?video_?id|loom_?id|id)$/i) || find(/video_?id$/i);
    const ku = find(/^(video_?url|url|share_?url|link|loom_?url)$/i);
    if (ka && want.ari) a[ka] = want.ari;
    else if (k) a[k] = want.videoId; else if (ku) a[ku] = 'https://www.loom.com/share/' + want.videoId; else a.videoId = want.videoId;
  }
  if (want.offset !== undefined) { const k = find(/^offset$/i); if (k) a[k] = want.offset; }
  if (want.from) { const k = find(/^(created_?at_?from|created_?after|created_?since|from_?date|start_?date|since)$/i); if (k) a[k] = want.from; }
  if (want.format) {
    const k = find(/^transcript_?format$/i);
    if (k) { const en = ((p[k] && p[k].enum) || []) as string[]; a[k] = !en.length || en.indexOf(want.format) >= 0 ? want.format : (en.indexOf('phrases') >= 0 ? 'phrases' : en[0]); }
  }
  if (want.limit) {
    const k = find(/^(limit|first|page_?size|per_?page|max_?results|count|size)$/i);
    if (k) { const mx = num(p[k] && p[k].maximum); a[k] = mx ? Math.min(want.limit, mx) : want.limit; }
  }
  if (want.cursor) {
    const k = find(/^(cursor|after|next_?cursor|page_?token|next_?page_?token|start_?cursor|continuation(_?token)?|offset_?token|page_?cursor)$/i);
    if (k) a[k] = want.cursor;
  }
  if (want.transcript !== undefined) {
    for (const k of keys) {
      const s = (p[k] || {}) as Json; const ty = s.type;
      const isBool = ty === 'boolean' || (Array.isArray(ty) && ty.indexOf('boolean') >= 0);
      if (isBool && /transcript/i.test(k)) a[k] = want.transcript;
      else if (isBool && /participant|attendee|speaker/i.test(k)) a[k] = true;
      else if (isBool && /^include/i.test(k)) a[k] = false;
      else if (/^(include|includes|fields|expand|with|sections|parts)$/i.test(k) && ty === 'array') {
        const en = ((s.items && s.items.enum) || []) as unknown[];
        const pick = en.filter((v) => /transcript|participant|speaker/i.test(String(v)));
        a[k] = pick.length ? pick : (en.length ? [] : ['transcript']);
      } else if (/^(include|includes|fields|expand)$/i.test(k) && ty === 'string') {
        const en = (s.enum || []) as unknown[]; const tv = en.find((v) => /transcript/i.test(String(v)));
        a[k] = tv !== undefined ? tv : 'transcript';
      }
    }
  }
  return a;
}

/* ---------- recordings ---------- */
export function loomIdOf(x: Json): string {
  const hex = (v: unknown): string => { const s = str(v).toLowerCase().replace(/-/g, ''); return /^[0-9a-f]{32}$/.test(s) ? s : ''; };
  for (const k of ['id', 'videoId', 'video_id', 'loomId', 'loom_id', 'loomVideoId']) { const h = hex(x[k]); if (h) return h; }
  for (const k of ['ari', 'videoAri', 'video_ari', 'id', 'videoId']) { const m = str(x[k]).match(/:video\/(?:activation\/[^/]+\/)?([0-9a-f]{32})\b/i); if (m) return m[1].toLowerCase(); }
  for (const k of ['url', 'shareUrl', 'share_url', 'link', 'embedUrl', 'embed_url', 'webUrl', 'web_url', 'videoUrl']) {
    const m = str(x[k]).match(/loom\.com\/(?:share|embed)\/([0-9a-f]{32})/i); if (m) return m[1].toLowerCase();
  }
  return '';
}
export function videosIn(d: unknown): Json[] {
  let best: Json[] = []; let bestScore = 0;
  walk(d, (v) => {
    if (!Array.isArray(v) || !v.length) return;
    const objs = v.filter((x) => x && typeof x === 'object' && !Array.isArray(x)) as Json[];
    const score = objs.filter((x) => loomIdOf(x)).length;
    if (score > bestScore) { best = objs.filter((x) => loomIdOf(x)); bestScore = score; }
  });
  if (!best.length && d && typeof d === 'object' && !Array.isArray(d) && loomIdOf(d as Json)) best = [d as Json];
  return best;
}
/* the recording's own object in a getLoomVideo answer (the one carrying its id with the most fields) */
export function videoObjectIn(d: unknown, id: string): Json | null {
  let best: Json | null = null;
  walk(d, (v) => { if (v && typeof v === 'object' && !Array.isArray(v) && loomIdOf(v as Json) === id && (!best || Object.keys(v as Json).length > Object.keys(best).length)) best = v as Json; });
  return best;
}
export function nextCursorIn(d: unknown): string {
  let c = '';
  walk(d, (v, k) => { if (!c && /^(next_?cursor|end_?cursor|next_?page_?token|next|cursor|after)$/i.test(k) && typeof v === 'string' && v && !/^https?:/i.test(v)) c = v; });
  return c;
}
function personName(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (v && typeof v === 'object') { const o = v as Json; return str(o.name) || str(o.displayName) || str(o.display_name) || str(o.fullName) || [str(o.firstName), str(o.lastName)].filter(Boolean).join(' ') || str(o.email); }
  return '';
}
export type Video = { id: string; ari: string; title: string; created: string; duration_s: number | null; owner: string; privacy: string; folder: string; meeting: boolean; participants: string[]; shared: boolean; summary?: string };
export function normVideo(x: Json, shared = false): Video {
  const created = str(x.createdAt) || str(x.created_at) || str(x.recordedAt) || str(x.recorded_at) || str(x.createdTime) || str(x.created) || str(x.date) || str(x.startTime) || '';
  let dur = num(x.duration) ?? num(x.sourceDuration) ?? num(x.playableDuration) ?? num(x.durationSeconds) ?? num(x.duration_s) ?? num(x.durationInSeconds);
  const ms = num(x.durationMs) ?? num(x.duration_ms);
  if (dur === null && ms !== null) dur = ms / 1000;
  if (dur !== null && dur > 86400) dur = dur / 1000;
  const typeText = [x.type, x.source, x.recordingType, x.recording_type, x.kind, x.videoType, x.origin].map(str).join(' ');
  const parts = [x.participants, x.attendees, x.invitees, x.collaborators, x.speakers].find((a) => Array.isArray(a)) as unknown[] | undefined;
  const ari = [x.ari, x.videoAri, x.video_ari, x.id].map(str).find((a) => /^ari:cloud:loom:/i.test(a)) || '';
  return {
    id: loomIdOf(x),
    ari,
    title: str(x.name) || str(x.title) || str(x.videoName) || str(x.video_name) || '',
    created,
    duration_s: dur === null ? null : Math.round(dur),
    owner: personName(x.owner) || str(x.ownerName) || str(x.owner_name) || personName(x.creator) || personName(x.createdBy) || personName(x.created_by) || personName(x.author) || '',
    privacy: str(x.privacy) || str(x.visibility) || str(x.sharing) || str(x.privacySetting) || str(x.privacy_setting) || str(x.accessLevel) || str(x.access_level) || str(x.permission) || '',
    folder: personName(x.folder) || str(x.folderName) || str(x.folder_name) || '',
    meeting: x.isMeeting === true || x.is_meeting === true || x.meeting === true || !!x.meetingId || !!x.meeting_id || /meeting|zoom|google meet|teams call/i.test(typeText),
    participants: (parts || []).map(personName).filter(Boolean).slice(0, 30),
    shared,
    summary: str(x.description) || str(x.summary) || '',
  };
}
function merged(a: Video, b: Video): Video {
  return {
    id: a.id || b.id, ari: a.ari || b.ari, title: b.title || a.title, created: b.created || a.created, duration_s: b.duration_s ?? a.duration_s, owner: b.owner || a.owner,
    privacy: b.privacy || a.privacy, folder: b.folder || a.folder, meeting: a.meeting || b.meeting,
    participants: b.participants.length ? b.participants : a.participants, shared: a.shared, summary: b.summary || a.summary || '',
  };
}

/* ---------- the transcript, as "MM:SS Name: text" lines like the uploads ---------- */
type Seg = { t: number | null; who: string; text: string };
function clock(s: number): string {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h ? h + ':' + p(m) + ':' + p(x) : p(m) + ':' + p(x);
}
function secondsOf(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = str(v);
  if (!s) return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  const m = s.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d+))?$/);
  if (m) return (Number(m[1] || 0) * 3600) + Number(m[2]) * 60 + Number(m[3]) + (m[4] ? Number('0.' + m[4]) : 0);
  return null;
}
function segOf(o: Json): Seg | null {
  let text = str(o.text) || str(o.content) || str(o.value) || str(o.transcript) || str(o.sentence) || str(o.body) || str(o.caption);
  if (!text && Array.isArray(o.words)) text = (o.words as unknown[]).map((w) => typeof w === 'string' ? w : str((w as Json).text) || str((w as Json).word)).join(' ').replace(/\s+([,.!?;:])/g, '$1');
  if (!text) return null;
  const who = personName(o.speaker) || str(o.speakerName) || str(o.speaker_name) || personName(o.participant) || str(o.name) || str(o.author) || '';
  const msKey = ['startMs', 'start_ms', 'startTimeMs', 'offsetMs', 'timestampMs'].find((k) => o[k] !== undefined);
  let t: number | null = null;
  if (msKey) { const v = num(o[msKey]); t = v === null ? null : v / 1000; }
  else for (const k of ['start', 'startTime', 'start_time', 'startSeconds', 'start_seconds', 'startTs', 'ts', 'timestamp', 'offset', 'time', 'from', 'begin']) {
    if (o[k] !== undefined) { t = secondsOf(o[k]); if (t !== null) break; }
  }
  return { t, who: who.replace(/\s+/g, ' ').trim(), text: text.replace(/\s+/g, ' ').trim() };
}
function segsFromText(raw: string): Seg[] {
  const out: Seg[] = [];
  const s = raw.replace(/\r\n?/g, '\n');
  if (/^\s*WEBVTT/.test(s) || /\d{2}:\d{2}(?::\d{2})?[.,]\d{3}\s*-->/.test(s)) {
    for (const block of s.split(/\n\s*\n/)) {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      const i = lines.findIndex((l) => /-->/.test(l));
      if (i < 0) continue;
      const t = secondsOf(lines[i].split('-->')[0].trim());
      let body = lines.slice(i + 1).join(' ');
      let who = '';
      const v = body.match(/^<v(?:\.[^ >]*)?\s+([^>]+)>/); if (v) { who = v[1].trim(); }
      body = body.replace(/<[^>]+>/g, '').trim();
      if (!who) { const m = body.match(/^([A-Z][\w'.-]*(?: [A-Z][\w'.-]*){0,3}):\s+(.*)$/); if (m) { who = m[1]; body = m[2]; } }
      if (body) out.push({ t, who, text: body });
    }
    return out;
  }
  for (const line of s.split('\n')) {
    const l = line.trim(); if (!l) continue;
    let m = l.match(/^\[?((?:\d+:)?\d{1,2}:\d{2}(?:[.,]\d+)?)\]?\s*[-–]?\s*(?:([A-Z][\w'.-]*(?: [A-Z][\w'.-]*){0,3})\s*:\s*)?(.*)$/);
    if (m && m[3]) { out.push({ t: secondsOf(m[1]), who: m[2] || '', text: m[3].trim() }); continue; }
    m = l.match(/^([A-Z][\w'.-]*(?: [A-Z][\w'.-]*){0,3})\s*(?:\((?:\d+:)?\d{1,2}:\d{2}\))?\s*:\s+(.*)$/);
    if (m) { out.push({ t: null, who: m[1], text: m[2].trim() }); continue; }
    if (out.length && !out[out.length - 1].t && !out[out.length - 1].who) out[out.length - 1].text += ' ' + l; else out.push({ t: null, who: '', text: l });
  }
  return out;
}
export function transcriptOf(d: unknown): { lines: string[]; speakers: string[]; segs: number } {
  let segs: Seg[] = [];
  /* 1. an array of pieces with text, under a transcript-like key (or the biggest such array) */
  let bestArr: Seg[] = []; let bestScore = 0;
  walk(d, (v, k) => {
    if (!Array.isArray(v) || v.length < 2) return;
    const s = v.filter((x) => x && typeof x === 'object' && !Array.isArray(x)).map((x) => segOf(x as Json)).filter(Boolean) as Seg[];
    if (s.length < Math.max(2, v.length * 0.6)) return;
    const score = s.length + (/transcript|caption|phrase|segment|utterance|paragraph|sentence|entr|line|cue/i.test(k) ? 1e6 : 0);
    if (score > bestScore) { bestArr = s; bestScore = score; }
  });
  if (bestArr.length) segs = bestArr;
  /* 2. a transcript held as text */
  if (!segs.length) {
    let text = ''; let best = -1;
    walkPath(d, (v, path) => {
      if (typeof v !== 'string' || v.trim().length < 2) return;
      const k = path[path.length - 1] || '';
      const under = path.some((p) => /transcript|caption|vtt|srt/i.test(p));
      const score = /transcript|caption|vtt|srt/i.test(k) ? 3 : (under && /^(text|content|value|body|plain(text)?)$/i.test(k) ? 2 : (!under && /^(text|content)$/i.test(k) && v.length > 200 ? 1 : 0));
      if (score > best && score > 0) { best = score; text = v; }
    });
    if (!text && typeof d === 'string') {
      const m = d.match(/(?:^|\n)\s*#*\s*\**transcript\**\s*:?\s*\n([\s\S]+)$/i);
      text = m ? m[1] : (/\d{1,2}:\d{2}/.test(d) ? d : '');
    }
    if (text) segs = segsFromText(text);
  }
  segs = segs.filter((s) => s.text && !/^\[?(music|silence|inaudible|no speech)\]?$/i.test(s.text));
  if (!segs.length) return { lines: [], speakers: [], segs: 0 };
  /* milliseconds given as plain numbers: a "time" past ten hours means the whole list is in ms */
  const maxT = Math.max(...segs.map((s) => s.t || 0));
  if (maxT > 36000) segs.forEach((s) => { if (s.t !== null) s.t = s.t / 1000; });
  /* very small pieces (word by word) are joined per speaker, up to about 400 characters */
  const avg = segs.reduce((a, s) => a + s.text.length, 0) / segs.length;
  if (avg < 25) {
    const joined: Seg[] = [];
    for (const s of segs) {
      const last = joined[joined.length - 1];
      if (last && last.who === s.who && last.text.length < 400) last.text += ' ' + s.text; else joined.push({ ...s });
    }
    segs = joined;
  }
  const good = (w: string) => !!w && !/^(speaker|unknown|participant|guest)\s*\d*$/i.test(w);
  const lines = segs.map((s) => (s.t !== null ? clock(s.t) + ' ' : '') + (good(s.who) ? s.who + ': ' : '') + s.text);
  const speakers = [...new Set(segs.map((s) => s.who).filter(good))].slice(0, 15);
  return { lines, speakers, segs: segs.length };
}

/* =====================================================================================================================
   Deciding: personal, sensitive, board, leadership, team meeting, or confidential
   ===================================================================================================================== */
const PERSONAL_TITLE = /\b(alcoholics anonymous|narcotics anonymous|al-?anon|aa (meeting|group|call|share)|sponsor(ship)? call|with my sponsor|sponsee|sobriety|step work|big book|home group|recovery (meeting|call|group|share|program))\b|^personal\b|\bpersonal\b.*\b(note|call|video|recording)\b/i;
const PERSONAL_MARKERS: RegExp[] = [
  /\b(alcoholics|narcotics|cocaine) anonymous\b|\bal-?anon\b/i,
  /\bmy sponsor\b|\bsponsees?\b/i,
  /\bsobriety\b|\bsober (since|for|living|date)\b|\bdays sober\b/i,
  /\b(twelve|12)[- ]steps?\b|\bstep work\b|\bfourth step\b|\bninth step\b/i,
  /\bbig book\b/i,
  /\bhigher power\b/i,
  /\bhome group\b/i,
  /\brelapse[ds]?\b/i,
  /\bmy recovery\b|\bin recovery\b/i,
];
export function personalText(text: string): boolean { return PERSONAL_MARKERS.filter((re) => re.test(text)).length >= 2; }
const SENSITIVE: RegExp[] = [
  /\bstep(?:ping|s|ped)? (?:down|back|away|aside) (?:as|from)\b/i,
  /\btransition(?:ing)? (?:out|away|off)\b|\bmy transition\b/i,
  /\bsuccession\b|\bsuccessors?\b/i,
  /\bresign(?:ation|ing|ed|s)?\b/i,
  /\b(?:my|his|her|their) (?:replacement|last day)\b/i,
  /\b(?:leav|quitt)ing (?:welfare avenue|the (?:org|organi[sz]ation|charity|board))\b/i,
  /\bdisciplinary\b|\bperformance improvement plan\b|\bmisconduct\b|\bgrievances?\b/i,
  /\b(?:terminat(?:e|ed|ing)|let go of|dismiss(?:ed)?) (?:him|her|them)\b|\b(?:got|been|be|was|were) fired\b/i,
  /\bharass(?:ment|ed|ing)?\b/i,
  /\b(?:his|her|their|my|your) (?:salary|salaries|wages?|compensation)\b|\bpay (?:cut|rise|raise)\b/i,
  /\blawsuit\b|\blegal action\b|\bsue (?:us|them|him|her)\b|\bcease and desist\b|\bour lawyer\b/i,
];
export function sensitiveText(text: string): boolean { return SENSITIVE.some((re) => re.test(text)); }
const TEAM_MEETINGS: Array<[RegExp, string]> = [
  [/\btoronto\b.*\b(operations|ops)\b|\b(operations|ops)\b.*\btoronto\b/i, 'opsto'],
  [/\b(operations|ops) (team )?(meetings?|sync|check-?in)\b/i, 'opsmtl'],
  [/\bfundraising (team )?meetings?\b/i, 'fundraising'],
  [/\bfinance (team )?meetings?\b/i, 'finance'],
  [/\bmarketing (team )?meetings?\b/i, 'marketing'],
  [/\b(human res?sources|hr) (team )?meetings?\b/i, 'hr'],
  [/\bprogram development (team )?meetings?\b/i, 'progdev'],
];
const LEADERSHIP = /\bleadership\b|\bexec(?:utive)? (?:team|meeting|sync|check-?in)\b|\bco-?eds?\b|\bexecutive directors?\b/i;
const BOARD = /\bboard\b|\bagm\b|\bannual general\b/i;
const DEPT_WORDS: Array<[RegExp, string]> = [
  [/\btoronto\b/i, 'opsto'],
  [/\binterview|\bonboard|\bhiring\b|\brecruit|\bhuman resources\b|\bhr\b|\borientation\b/i, 'hr'],
  [/\bprogram development\b|\bprog ?dev\b|\bresearch\b|\bimpact report|\bsurvey\b|\bevaluation\b/i, 'progdev'],
  [/\bmarketing\b|\bbrand|\bcontent\b|\bsocial media\b|\binstagram\b|\btiktok\b|\blinkedin\b|\bwebsite\b|\bnewsletter\b|\bdesign\b|\bcanva\b|\bphoto|\breels?\b/i, 'marketing'],
  [/\bfinances?\b|\bbudget\b|\baccount(?:ing|ant)\b|\bbookkeep|\binvoices?\b|\breimburs/i, 'finance'],
  [/\bfundrais|\bgrants?\b|\bdonors?\b|\bdonations?\b|\bgala\b|\bsponsors?\b|\brally\b|\bcampaign\b|\bevents?\b/i, 'fundraising'],
  [/\boperations\b|\bops\b|\bserving\b|\bkitchen\b|\blogistics\b|\binventory\b|\bvolunteers?\b|\bmontreal\b/i, 'opsmtl'],
];
export const DEPT_LABEL: Record<string, string> = { opsmtl: 'Operations Montreal', opsto: 'Operations Toronto', marketing: 'Marketing', fundraising: 'Fundraising', finance: 'Finance', hr: 'Human Resources', progdev: 'Program Development', board: 'the board', 'Leadership meeting': 'Leadership' };
export type Person = { name: string; email?: string; department?: string };
export type Ctx = { roster: Person[]; leaders: string[] };
/* a speaker's roster name: the same full name, or the same first name when the roster has only a first name and it is unique */
export function matchRoster(name: string, roster: Person[]): Person | null {
  const n = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!n) return null;
  if (n.indexOf('@') > 0) return roster.find((p) => String(p.email || '').toLowerCase() === n) || null;
  const exact = roster.find((p) => p.name.toLowerCase() === n);
  if (exact) return exact;
  const first = n.split(' ')[0];
  const same = roster.filter((p) => p.name.toLowerCase().split(' ')[0] === first);
  if (same.length !== 1) return null;
  const p = same[0];
  if (p.name.trim().split(/\s+/).length === 1) return p;
  if (n.split(' ').length === 1) return p;
  return null;
}
export type Decision = { status: 'filed' | 'needs_look' | 'skipped' | 'personal' | 'waiting' | 'error'; reason: string; department?: string; visibility?: string | null; allowed?: string[] };
export function peopleIn(v: Video, speakers: string[], ctx: Ctx): Person[] {
  const out: Person[] = [];
  for (const n of [...speakers, ...v.participants, v.owner]) { const p = matchRoster(n, ctx.roster); if (p && out.indexOf(p) < 0) out.push(p); }
  return out;
}
export function allowedFor(v: Video, speakers: string[], ctx: Ctx): string[] {
  const names = peopleIn(v, speakers, ctx).map((p) => p.name).concat(ctx.leaders || []);
  return [...new Set(names.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
/* v2: a one-on-one (the title says so, or it is two to four first names joined by /, x, & or +) with four speakers at most */
const ONE_ON_ONE = /\b1\s*on\s*1(?:\s*on\s*1)?\b|\b1:1\b|\bone[- ]on[- ]one\b/i;
const NAMES_JOINED = /^\s*[A-Z][\p{L}'.-]+(?:\s[A-Z][\p{L}'.-]+)?\s*(?:\/|\bx\b|&|\+)\s*[A-Z][\p{L}'.-]+/u;
export function isOneOnOne(title: string, speakers: string[]): boolean {
  const t = String(title || '');
  if ((speakers || []).length > 4) return false;
  return ONE_ON_ONE.test(t) || NAMES_JOINED.test(t);
}
/* the people speaking, matched to the roster: each one's name and email, and anyone unmatched as Loom names them. Loom's
   transcript does not always name every voice, so the names a one-on-one's title joins (Suhaib / Steel) are added, and when
   that still leaves one person, the people Loom lists on the meeting (not its recorder) (loom_file adds the other addresses a
   member signs in with: wa_people_expand) */
const BOTS = /^(loom|hub|notetaker|recorder|noreply|no-reply|info)@/i;
export function titleNames(title: string): string[] {
  const t = String(title || '').replace(/\s+-\s.*$|\s*\(.*$/, '');
  if (!NAMES_JOINED.test(t)) return [];
  return t.split(/\s*(?:\/|\bx\b|&|\+|,)\s*/).map((w) => w.replace(/\b1\s*on\s*1(?:\s*on\s*1)?\b|\b1:1\b/gi, '').trim()).filter((w) => /^[A-Z][\p{L}'.-]+(?:\s[A-Z][\p{L}'.-]+)?$/u.test(w) && !/^(Meeting|Check|Weekly|Team|The)$/i.test(w));
}
export function speakersAllowed(title: string, speakers: string[], roster: Person[], participants: string[] = []): string[] {
  const key = (n: string) => { const p = matchRoster(n, roster); return p ? p.name.toLowerCase() : String(n || '').trim().toLowerCase(); };
  const names: string[] = []; const seen = new Set<string>();
  const push = (n: string) => { const v = String(n || '').trim(); const k = key(v); if (v && !seen.has(k)) { seen.add(k); names.push(v); } };
  (speakers || []).forEach(push);
  titleNames(title).forEach(push);
  if (!names.length) String(title || '').split(/\s*(?:\/|\bx\b|&|\+|,| - )\s*/).map((w) => w.trim()).filter((w) => /^[A-Z][\p{L}'.-]+(?:\s[A-Z][\p{L}'.-]+)?$/u.test(w) && !/^(Meeting|Check|Weekly|Team|The)$/i.test(w)).forEach(push);
  if (seen.size < 2) (participants || []).filter((x) => /@/.test(String(x)) && !BOTS.test(String(x))).forEach(push);
  const out: string[] = [];
  const add = (x: string) => { const v = String(x || '').trim(); if (v && out.indexOf(v) < 0) out.push(v); };
  for (const n of names) {
    const p = matchRoster(n, roster);
    if (p) { add(p.name); if (p.email) add(p.email); }
    else add(n);
  }
  return out;
}
function teamOf(title: string, people: Person[]): string {
  for (const [re, d] of DEPT_WORDS) if (re.test(title)) return d;
  const count: Record<string, number> = {};
  for (const p of people) { const d = String(p.department || ''); if (d && !/^(exec|board|leadership)$/i.test(d)) count[d] = (count[d] || 0) + 1; }
  const top = Object.entries(count).sort((a, b) => b[1] - a[1]);
  if (!top.length) return '';
  if (top.length > 1 && top[0][1] === top[1][1]) return '';
  return top[0][0];
}
export function classify(v: Video, tx: { lines: string[]; speakers: string[] }, ctx: Ctx, ageDays: number, attempts: number): Decision {
  const title = v.title || '';
  if (PERSONAL_TITLE.test(title) || PERSONAL_TITLE.test(v.folder || '') || /^(personal|private|me|recovery)$/i.test(v.folder || '')) return { status: 'personal', reason: '' };
  if (!tx.lines.length) {
    if (ageDays >= 5 || attempts >= 5) return { status: 'skipped', reason: 'Loom has no transcript for it' };
    return { status: 'waiting', reason: 'Loom has no transcript for it yet; the next pull tries again' };
  }
  const body = tx.lines.join('\n');
  if (personalText(body)) return { status: 'personal', reason: '' };
  const team = TEAM_MEETINGS.find(([re]) => re.test(title));
  const lead = LEADERSHIP.test(title), board = BOARD.test(title);
  /* Loom's own sharing setting is not used: the meeting recorder keeps every recording to its owner by default (checked 28/09/26) */
  const people = peopleIn(v, tx.speakers, ctx);
  if (!team && !lead && !board && tx.speakers.length < 2) return { status: 'skipped', reason: 'One person speaking: a recording, not a meeting' };
  if (board) return { status: 'needs_look', reason: 'A board meeting: an admin decides where it goes' };
  /* v2: a one-on-one is only for the people speaking in it (filed before the sensitive check: nobody else reads it) */
  if (!team && !lead && isOneOnOne(title, tx.speakers)) {
    const allowed = speakersAllowed(title, tx.speakers, ctx.roster, v.participants);
    const dept = teamOf(title, people) || 'board';
    if (allowed.length) return { status: 'filed', reason: 'A one-on-one, so only the people speaking in it see it', department: dept, visibility: 'speakers', allowed };
  }
  if (sensitiveText(title + '\n' + body)) return { status: 'needs_look', reason: 'May hold something sensitive, so an admin decides who sees it' };
  if (v.shared && v.owner && !matchRoster(v.owner, ctx.roster) && !team) return { status: 'needs_look', reason: 'Shared by someone outside the team' };
  if (lead) return { status: 'filed', reason: 'Leadership meeting, so the leaders see it', department: 'Leadership meeting', visibility: 'leadership' };
  if (team) return { status: 'filed', reason: 'Team meeting, so everyone sees it', department: team[1], visibility: null };
  const dept = teamOf(title, people);
  if (!dept) return { status: 'needs_look', reason: 'Which team it belongs to is unclear' };
  const allowed = allowedFor(v, tx.speakers, ctx);
  return { status: 'filed', reason: 'Not a team meeting, so it is confidential to the people in it and the leaders', department: dept, visibility: 'private', allowed };
}

/* ---------- dates ---------- */
export function torontoDay(iso: string): string {
  const d = iso ? new Date(iso) : new Date();
  const t = Number.isNaN(d.getTime()) ? new Date() : d;
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);
}
function isoOrNull(s: string): string | null { if (!s) return null; const d = new Date(/^\d{10}$/.test(s) ? Number(s) * 1000 : (/^\d{13}$/.test(s) ? Number(s) : s)); return Number.isNaN(d.getTime()) ? null : d.toISOString(); }

/* =====================================================================================================================
   Talking to Loom
   ===================================================================================================================== */
type Session = { m: Mcp; list: Json | null; shared: Json | null; get: Json | null; tx: Json | null; cloudId: string; sites: Json[]; sitesRaw?: unknown };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/* the Atlassian sites (cloud ids) the key can reach, from getAccessibleAtlassianResources */
export function sitesIn(d: unknown): Json[] {
  const out: Json[] = []; const ids = new Set<string>();
  walk(d, (v) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return;
    const o = v as Json; const id = [o.cloudId, o.cloud_id, o.id, o.siteId].map(str).find((x) => UUID.test(x));
    if (id && !ids.has(id)) { ids.add(id); out.push({ id, name: str(o.name) || str(o.displayName) || str(o.siteName), url: str(o.url) || str(o.siteUrl) || str(o.baseUrl), scopes: o.scopes || o.products || null }); }
  });
  if (!out.length) walk(d, (v) => { if (typeof v === 'string') { const m = v.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i); if (m && !ids.has(m[0])) { ids.add(m[0]); out.push({ id: m[0], name: '', url: '', scopes: null }); } } });
  return out;
}
async function connect(ctx: Json): Promise<Session> {
  /* wave162c: Atlassian's approval first (Connect Loom), then the API token */
  let oauthErr: unknown = null; let auth = '';
  try { auth = await oauthBearer(); } catch (e) { oauthErr = e; }
  if (!auth) {
    const email = await keyPart('ATLASSIAN_EMAIL'); const token = await keyPart('ATLASSIAN_API_TOKEN');
    if (email && token && !oauthErr) auth = 'Basic ' + btoa(email + ':' + token);
  }
  if (!auth) throw oauthErr || new McpError('no_key', 0, 'Loom is not connected yet: an admin presses Connect Loom on the Loom card and approves it as hub@welfareavenue.com');
  let url = String(ctx.mcp_url || 'https://mcp.atlassian.com/v2/mcp');
  if (!/[?&]tools=/.test(url)) url += (url.indexOf('?') >= 0 ? '&' : '?') + 'tools=all';
  const m = new Mcp(url, auth);
  await m.init();
  await m.listTools();
  const s: Session = {
    m,
    list: m.tool(/^listLoomVideos$/i) || m.tool(/^list.*loom.*videos?$/i) || m.tool(/^(list|search).*loom/i),
    shared: m.tool(/^listLoomVideosSharedWithMe$/i) || m.tool(/^list.*loom.*shared/i),
    get: m.tool(/^getLoomVideo$/i) || m.tool(/^get.*loom.*video$/i),
    tx: m.tool(/^get.*loom.*transcript/i),
    cloudId: String(ctx.cloud_id || ''),
    sites: [],
  };
  if (s.shared && s.list && s.shared.name === s.list.name) s.shared = null;
  const needsCloud = [s.list, s.get].some((t) => t && Object.keys(propsOf(t)).some((k) => /^cloud_?id$/i.test(k)));
  if (!s.cloudId && needsCloud) {
    const r = m.tool(/^getAccessibleAtlassianResources$/i);
    if (r) {
      const d = await m.call(String(r.name), {});
      s.sitesRaw = d;
      s.sites = sitesIn(d);
      const withLoom = s.sites.find((x) => /loom/i.test(JSON.stringify(x.scopes || '')) || /loom/i.test(str(x.url) + ' ' + str(x.name)));
      s.cloudId = str((withLoom || s.sites[0] || {}).id);
    }
  }
  return s;
}
export function sinceIso(since: string): string { return /^\d{4}-\d{2}-\d{2}$/.test(since) ? since + 'T04:00:00.000Z' : '2026-09-02T04:00:00.000Z'; }
async function listAll(s: Session, since: string, deadline: number): Promise<Video[]> {
  const seen = new Map<string, Video>();
  const from = sinceIso(since); const fromT = Date.parse(from);
  const LIMIT = 100;
  for (const [tool, shared] of [[s.list, false], [s.shared, true]] as Array<[Json | null, boolean]>) {
    if (!tool) continue;
    const byOffset = Object.keys(propsOf(tool)).some((k) => /^offset$/i.test(k));
    let cursor = '';
    for (let page = 0; page < 10 && Date.now() < deadline; page++) {
      const d = await s.m.call(String(tool.name), argsFor(tool, { cloudId: s.cloudId, limit: LIMIT, offset: byOffset ? page * LIMIT : undefined, cursor: cursor || undefined, from }));
      const raw = videosIn(d);
      const vids = raw.map((x) => normVideo(x, shared));
      let older = 0;
      for (const v of vids) {
        const t = Date.parse(v.created);
        if (!Number.isNaN(t) && t < fromT) { older++; continue; }
        if (v.id && !seen.has(v.id)) seen.set(v.id, v);
      }
      if (!vids.length || (older && older === vids.length)) break;
      if (byOffset) { if (raw.length < LIMIT) break; continue; }
      const next = nextCursorIn(d);
      if (!next || next === cursor) break;
      cursor = next;
    }
  }
  return [...seen.values()];
}
async function fetchVideo(s: Session, id: string, ari = '', format = 'phrases'): Promise<{ meta: Video | null; tx: { lines: string[]; speakers: string[]; segs: number }; raw: unknown }> {
  if (!s.get) throw new Error('Loom has no getLoomVideo tool on this server');
  const d = await s.m.call(String(s.get.name), argsFor(s.get, { cloudId: s.cloudId, videoId: id, ari, transcript: true, format }));
  const obj = videoObjectIn(d, id);
  const meta = obj ? normVideo(obj) : null;
  let tx = transcriptOf(d);
  if (!tx.lines.length && s.tx) {
    try { const d2 = await s.m.call(String(s.tx.name), argsFor(s.tx, { cloudId: s.cloudId, videoId: id })); tx = transcriptOf(d2); } catch (_) { /* no transcript tool answer */ }
  }
  return { meta, tx, raw: d };
}

/* =====================================================================================================================
   The run
   ===================================================================================================================== */
type Counts = { seen: number; filed: number; needs_look: number; skipped: number; waiting: number; errors: number };
async function rpc(name: string, args: Json): Promise<unknown> {
  const { data, error } = await svc.rpc(name, args);
  if (error) throw new Error(name + ': ' + error.message);
  return data;
}
async function sync(runId: number, addedBy: string): Promise<{ status: string; counts: Counts; note: string }> {
  const started = Date.now(); const deadline = started + BUDGET_MS;
  const counts: Counts = { seen: 0, filed: 0, needs_look: 0, skipped: 0, waiting: 0, errors: 0 };
  const ctx = await rpc('loom_pull_context', {}) as Json;
  const people: Ctx = { roster: (ctx.roster || []) as Person[], leaders: (ctx.leaders || []) as string[] };
  const max = Math.max(1, Math.min(50, Number(ctx.max) || 10));
  let s: Session;
  try { s = await connect(ctx); } catch (e) {
    const k = e instanceof McpError ? e.kind : 'error';
    return { status: k === 'no_key' ? 'no_key' : (k === 'refused' ? 'refused' : 'error'), counts, note: String((e as Error).message || e).slice(0, 500) };
  }
  if (!s.list || !s.get) return { status: 'error', counts, note: 'The Loom tools are not on this MCP server (it has: ' + s.m.tools.map((t) => t.name).slice(0, 40).join(', ') + ')' };
  const vids = await listAll(s, String(ctx.since || '2026-09-02'), deadline - 30000);
  counts.seen = vids.length;
  const known = await rpc('loom_pull_known', { p_ids: vids.map((v) => v.id) }) as Json;
  const kv = (known.videos || {}) as Json; const archive = (known.archive || {}) as Json;
  const todo: Video[] = [];
  for (const v of vids) {
    const k = kv[v.id];
    if (archive[v.id] && (!k || k.status !== 'filed')) {
      await rpc('loom_file_seen', { p_loom_id: v.id, p_transcript_id: archive[v.id], p_title: v.title }).catch(() => null);
      continue;
    }
    if (!k || ((k.status === 'waiting' || k.status === 'error') && Number(k.attempts || 0) < 6)) todo.push(v);
  }
  todo.sort((a, b) => (Date.parse(a.created) || 0) - (Date.parse(b.created) || 0));
  let done = 0; let left = 0; const notes: string[] = [];
  for (const v0 of todo) {
    if (done >= max || Date.now() > deadline) { left++; continue; }
    done++;
    const k = kv[v0.id] || {};
    try {
      if (PERSONAL_TITLE.test(v0.title) || PERSONAL_TITLE.test(v0.folder)) { await save(v0, { status: 'personal', reason: '' }, [], addedBy); counts.skipped++; continue; }
      const got = await fetchVideo(s, v0.id, v0.ari);
      const v = got.meta ? merged(v0, got.meta) : v0;
      const created = isoOrNull(v.created);
      const ageDays = created ? (Date.now() - Date.parse(created)) / 86400000 : 0;
      const dec = classify(v, got.tx, people, ageDays, Number(k.attempts || 0));
      if (dec.status === 'filed') {
        const r = await rpc('loom_file', { p: filePayload(v, got.tx, dec, addedBy) }) as Json;
        counts.filed++;
        if (r && r.already) notes.push('one was already in the archive');
      } else {
        await save(v, dec, got.tx.speakers, addedBy);
        if (dec.status === 'needs_look') counts.needs_look++;
        else if (dec.status === 'waiting') counts.waiting++;
        else counts.skipped++;
      }
    } catch (e) {
      if (e instanceof McpError && e.kind === 'refused') return { status: 'refused', counts, note: e.message };
      counts.errors++;
      await save(v0, { status: 'error', reason: String((e as Error).message || e).slice(0, 250) }, [], addedBy).catch(() => null);
    }
  }
  const note = [left ? left + ' more wait for the next pull' : '', ...new Set(notes)].filter(Boolean).join('; ');
  return { status: counts.errors && !counts.filed ? 'error' : (left ? 'partial' : 'ok'), counts, note };
}
function filePayload(v: Video, tx: { lines: string[]; speakers: string[] }, dec: Decision, addedBy: string, extra: Json = {}): Json {
  const created = isoOrNull(v.created);
  return {
    ...extra,
    loom_id: v.id, title: v.title || ('Loom meeting ' + torontoDay(created || '')), body: tx.lines.join('\n'), meeting_date: torontoDay(created || ''),
    recorded_at: created, duration_s: v.duration_s, owner_name: v.owner || null, speakers: tx.speakers, loom_privacy: v.privacy || null,
    department: dec.department, visibility: dec.visibility || 'department', allowed_people: dec.allowed || null, reason: dec.reason, added_by: addedBy,
  };
}
async function save(v: Video, dec: Decision, speakers: string[], by: string): Promise<void> {
  const created = isoOrNull(v.created);
  await rpc('loom_video_save', { p: {
    loom_id: v.id, status: dec.status, title: v.title, reason: dec.reason, recorded_at: created, meeting_date: created ? torontoDay(created) : null,
    duration_s: v.duration_s, owner_name: v.owner || null, speakers, loom_privacy: v.privacy || null, department: dec.department || null,
    visibility: dec.visibility === undefined ? null : (dec.visibility || 'department'), allowed_people: dec.allowed || null, decided_by: by,
  } });
}

/* ---------- probe: what Loom sends, without writing anything ---------- */
function schemaBrief(t: Json | null): Json | null {
  if (!t) return null;
  const p = propsOf(t); const out: Json = {};
  for (const [k, v] of Object.entries(p)) { const s = v as Json; out[k] = [s.type, s.enum ? 'enum ' + JSON.stringify(s.enum).slice(0, 120) : '', s.items && s.items.enum ? 'items ' + JSON.stringify(s.items.enum).slice(0, 120) : '', s.default !== undefined ? 'default ' + JSON.stringify(s.default) : '', str(s.description).slice(0, 140)].filter(Boolean).join(' | '); }
  return { name: t.name, description: str(t.description).slice(0, 300), required: (t.inputSchema && t.inputSchema.required) || [], props: out };
}
function shape(x: unknown, depth = 0): unknown {
  if (depth > 4) return '...';
  if (Array.isArray(x)) return x.length ? ['[' + x.length + ']', shape(x[0], depth + 1)] : [];
  if (x && typeof x === 'object') { const o: Json = {}; for (const [k, v] of Object.entries(x as Json).slice(0, 40)) o[k] = shape(v, depth + 1); return o; }
  if (typeof x === 'string') return 'string(' + x.length + ')' + (x.length <= 40 && !/\s{2,}/.test(x) ? ' ' + JSON.stringify(x) : '');
  return typeof x;
}
async function probe(): Promise<Json> {
  const ctx = await rpc('loom_pull_context', {}) as Json;
  const out: Json = { key: { email: !!(await keyPart('ATLASSIAN_EMAIL')), token: !!(await keyPart('ATLASSIAN_API_TOKEN')), connected: !!(await vaultOnly('LOOM_OAUTH_REFRESH')) } };
  let s: Session;
  try { s = await connect(ctx); } catch (e) { out.error = String((e as Error).message || e); out.kind = e instanceof McpError ? e.kind : 'error'; return out; }
  out.server = { protocol: s.m.proto, info: s.m.server, session: !!s.m.sid };
  out.tools = s.m.tools.map((t) => t.name);
  out.loom_tools = s.m.tools.filter((t) => /loom|getAccessibleAtlassianResources/i.test(String(t.name))).map(schemaBrief);
  out.picked = { list: s.list && s.list.name, shared: s.shared && s.shared.name, get: s.get && s.get.name, transcript: s.tx && s.tx.name };
  out.sites = s.sites.map((x) => ({ id: x.id, name: x.name, url: x.url, scopes: Array.isArray(x.scopes) ? x.scopes.filter((y: string) => /loom|read:me|account/i.test(String(y))) : x.scopes }));
  out.sites_raw = JSON.stringify(s.sitesRaw === undefined ? null : s.sitesRaw).slice(0, 1500);
  try { if (s.m.tool(/^atlassianUserInfo$/)) out.me = JSON.stringify(await s.m.call('atlassianUserInfo', {})).replace(/"(picture|avatar\w*)":"[^"]*"/g, '"$1":"..."').slice(0, 800); } catch (e) { out.me = 'error: ' + String((e as Error).message || e).slice(0, 200); }
  out.cloud_id = s.cloudId;
  if (s.list) {
    const args = argsFor(s.list, { cloudId: s.cloudId, limit: 10, offset: 0, from: sinceIso(String(ctx.since || '')) });
    try {
      const d = await s.m.call(String(s.list.name), args);
      const vids = videosIn(d).map((x) => normVideo(x));
      out.list = { args, shape: shape(d), count: vids.length, next: nextCursorIn(d) ? 'yes' : 'no',
        videos: vids.filter((v) => !PERSONAL_TITLE.test(v.title)).slice(0, 6).map((v) => ({ id: v.id, title: v.title.slice(0, 80), created: v.created, duration_s: v.duration_s, owner: v.owner, privacy: v.privacy, folder: v.folder, meeting: v.meeting, participants: v.participants.length })) };
      const pick = vids.find((v) => !PERSONAL_TITLE.test(v.title) && (v.meeting || TEAM_MEETINGS.some(([re]) => re.test(v.title)))) || vids.find((v) => !PERSONAL_TITLE.test(v.title));
      if (pick && s.get) {
        const gargs = argsFor(s.get, { cloudId: s.cloudId, videoId: pick.id, ari: pick.ari, transcript: true, format: 'both' });
        try {
          const g = await fetchVideo(s, pick.id, pick.ari, 'both');
          const personal = personalText(g.tx.lines.join('\n'));
          out.video = { args: gargs, id: pick.id, shape: shape(g.raw), meta: g.meta, transcript: { segs: g.tx.segs, lines: g.tx.lines.length, chars: g.tx.lines.join('\n').length, speakers: personal ? [] : g.tx.speakers.length, head: personal ? [] : g.tx.lines.slice(0, 4).map((l) => l.slice(0, 60)) } };
        } catch (e) { out.video = { args: gargs, error: String((e as Error).message || e) }; }
      }
    } catch (e) { out.list = { args, error: String((e as Error).message || e) }; }
  }
  return out;
}

/* ---------- file: an admin files a recording that needed a look ---------- */
async function fileOne(body: Json, who: string): Promise<Json> {
  const id = String(body.loom_id || '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(id)) throw new Error('A Loom id is needed');
  const dept = String(body.department || '');
  if (!DEPT_LABEL[dept] || dept === 'board') throw new Error('Pick the team it belongs to');
  const vis = String(body.visibility || 'private');
  if (['department', 'leadership', 'private', 'speakers'].indexOf(vis) < 0) throw new Error('Pick who sees it');
  const { data: row } = await svc.from('loom_videos').select('*').eq('loom_id', id).maybeSingle();
  if (row && (row.status === 'filed' || row.status === 'personal')) throw new Error(row.status === 'filed' ? 'That recording is already filed' : 'That recording was left out as personal');
  const ctx = await rpc('loom_pull_context', {}) as Json;
  const people: Ctx = { roster: (ctx.roster || []) as Person[], leaders: (ctx.leaders || []) as string[] };
  const s = await connect(ctx);
  const got = await fetchVideo(s, id);
  if (!got.tx.lines.length) throw new Error('Loom has no transcript for it yet');
  if (personalText(got.tx.lines.join('\n'))) throw new Error('That recording looks personal, so the Hub leaves it out');
  const base: Video = normVideo({ id, name: row ? row.title : '', createdAt: row && row.recorded_at ? row.recorded_at : '', owner: row ? row.owner_name : '' });
  const v = got.meta ? merged(base, got.meta) : base;
  const allowed = vis === 'private' ? allowedFor(v, got.tx.speakers, people) : (vis === 'speakers' ? speakersAllowed(v.title, got.tx.speakers, people.roster, v.participants) : undefined);
  if (vis === 'private' && (!allowed || !allowed.length)) throw new Error('Nobody on the Hub is in it; pick Leaders instead');
  if (vis === 'speakers' && (!allowed || !allowed.length)) throw new Error('Loom names nobody speaking in it; pick Confidential instead');
  const dec: Decision = { status: 'filed', reason: 'Filed by ' + who, department: vis === 'leadership' && body.department === 'Leadership meeting' ? 'Leadership meeting' : dept, visibility: vis === 'department' ? null : vis, allowed };
  const r = await rpc('loom_file', { p: filePayload(v, got.tx, dec, 'Loom pull (filed by ' + who + ')') }) as Json;
  return { ok: true, transcript_id: r.transcript_id, already: !!r.already };
}

/* v3 (wave237): one recording, now. The same decision as the sync; 'waiting' when Loom has no transcript yet (the sync retries). */
async function pullOne(body: Json, who: { kind: string; who: string }): Promise<Json> {
  const id = String(body.loom_id || '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(id)) throw new Error('A Loom id is needed');
  const { data: row } = await svc.from('loom_videos').select('*').eq('loom_id', id).maybeSingle();
  if (row && (row.status === 'filed' || row.status === 'personal')) return { ok: true, status: row.status, transcript_id: row.transcript_id || null, already: true };
  const ctx = await rpc('loom_pull_context', {}) as Json;
  const people: Ctx = { roster: (ctx.roster || []) as Person[], leaders: (ctx.leaders || []) as string[] };
  const s = await connect(ctx);
  const addedBy = who.kind === 'admin' ? 'Loom pull (' + who.who + ')' : 'Loom pull (' + String(body.why || 'recap email').replace(/[^\w .:-]/g, '').slice(0, 40) + ')';
  const base: Video = normVideo({ id, name: row ? row.title : '', createdAt: row && row.recorded_at ? row.recorded_at : '', owner: row ? row.owner_name : '' });
  let v = base;
  try {
    const got = await fetchVideo(s, id, '', 'phrases');
    v = got.meta ? merged(base, got.meta) : base;
    if (PERSONAL_TITLE.test(v.title) || PERSONAL_TITLE.test(v.folder || '')) { await save(v, { status: 'personal', reason: '' }, [], addedBy); return { ok: true, status: 'personal' }; }
    const created = isoOrNull(v.created);
    const ageDays = created ? (Date.now() - Date.parse(created)) / 86400000 : 0;
    const dec = classify(v, got.tx, people, ageDays, Number((row && row.attempts) || 0));
    if (dec.status === 'filed') {
      const r = await rpc('loom_file', { p: filePayload(v, got.tx, dec, addedBy) }) as Json;
      await svc.from('change_log').insert({ entity_type: 'loom', entity_id: id, field: 'pulled', old_value: null, new_value: 'transcript ' + r.transcript_id + (r.already ? ' (already in the archive)' : '') + ': ' + dec.reason, changed_by: addedBy }).then(() => null, () => null);
      return { ok: true, status: 'filed', transcript_id: r.transcript_id, already: !!r.already, reason: dec.reason, department: dec.department };
    }
    await save(v, dec, got.tx.speakers, addedBy);
    return { ok: true, status: dec.status, reason: dec.reason };
  } catch (e) {
    if (e instanceof McpError && e.kind === 'refused') throw e;
    await save(v, { status: 'error', reason: String((e as Error).message || e).slice(0, 250) }, [], addedBy).catch(() => null);
    throw e;
  }
}

/* =====================================================================================================================
   v2: the backfill. Older recordings kept for the archive and Ask the Hub only: never processed into tasks, updates,
   decisions, suggestions or ideas (transcripts.archive_only; the insert triggers skip them), each with a summary
   ===================================================================================================================== */
const ARCHIVE_SYSTEM = `You write the archive summary of one Welfare Avenue meeting. Welfare Avenue is a charity in Montreal and Toronto that serves free meals and runs community programs with volunteers. The Hub keeps this meeting for its archive and for Ask the Hub, which answers staff questions from these summaries later, so keep what someone might ask about.

Write 150 to 300 words as three short paragraphs, each starting with its label:
Discussed: the topics, with the people, partners, places, events, programs, tools, dates and numbers that came up.
Decided: what was agreed or decided, or "Nothing was decided."
Next steps: who took on what, with any dates, or "No next steps were set."

Rules: only what the meeting says; never guess or add. Past tense. Names as the transcript gives them. Plain sentences: no headings, no bullet points, no markdown. Never use em dashes: use commas, colons or parentheses.`;
/* Loom's notes and the model's text as plain prose: no markdown headings or bold, no em dashes */
export function cleanSummary(t: string): string {
  return String(t || '').replace(/\r\n?/g, '\n').replace(/^\s*#{0,6}\s*(?:meeting\s+|archive\s+)?summary:?\s*\n/i, '').replace(/^#{1,6}\s*/gm, '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\s*\u2014\s*/g, ', ').replace(/\n{3,}/g, '\n\n').trim();
}
async function summarize(v: Video, lines: string[], team: string): Promise<{ text: string; source: string }> {
  const notes = cleanSummary(v.summary || '');
  const head = 'MEETING: ' + (v.title || 'Loom meeting') + ' (' + (DEPT_LABEL[team] || team) + ', ' + torontoDay(isoOrNull(v.created) || '') + ')\n';
  const all = lines.join('\n');
  const text = all.length > 60000 ? all.slice(0, 45000) + '\n...\n' + all.slice(-15000) : all;
  try {
    const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
      method: 'POST', signal: AbortSignal.timeout(60000),
      headers: { Authorization: 'Bearer ' + SERVICE_KEY, 'x-wa-task': 'transcript_archive', 'x-wa-caller': 'loom-pull', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 1200, temperature: 0.2, system: ARCHIVE_SYSTEM,
        messages: [{ role: 'user', content: head + (notes ? '\nLOOM\'S OWN NOTES ON IT:\n' + notes.slice(0, 6000) + '\n' : '') + '\nTRANSCRIPT:\n' + text }] }),
    });
    if (res.ok) {
      const out = await res.json() as Json;
      const t = cleanSummary(((out.content || []) as Json[]).filter((c) => c && c.type === 'text').map((c) => String(c.text || '')).join('\n'));
      if (t.length >= 80) return { text: t.slice(0, 6000), source: 'ai' };
    }
  } catch (_) { /* Loom's own notes, below */ }
  if (notes.length >= 80) return { text: notes.slice(0, 6000), source: 'loom' };
  return { text: '', source: 'none' };
}
/* a recording's ARI from its id: the workspace's activation id, read once from a page of the list (getLoomVideo does not
   resolve a share link) */
async function loomAri(s: Session, id: string, cache: { act?: string }): Promise<string> {
  if (!cache.act && s.list) {
    const d = await s.m.call(String(s.list.name), argsFor(s.list, { cloudId: s.cloudId, limit: 1 }));
    walk(d, (v) => { if (!cache.act && typeof v === 'string') { const m = v.match(/^ari:cloud:loom:[^:]+:video\/activation\/([^/]+)\/[0-9a-f]{32}$/i); if (m) cache.act = m[1]; } });
  }
  return cache.act ? 'ari:cloud:loom:' + s.cloudId + ':video/activation/' + cache.act + '/' + id : '';
}
type BackItem = { id: string; department: string; visibility?: string | null };
async function backfill(body: Json, who: string): Promise<Json> {
  const items = (Array.isArray(body.items) ? body.items : []) as BackItem[];
  if (!items.length) throw new Error('No recordings given');
  if (items.length > 100) throw new Error('At most 100 recordings at a time');
  const dry = body.dry_run === true;
  const deadline = Date.now() + Math.max(20000, Math.min(BUDGET_MS, Number(body.budget_ms) || BUDGET_MS));
  const ctx = await rpc('loom_pull_context', {}) as Json;
  const roster = (ctx.roster || []) as Person[];
  const people: Ctx = { roster, leaders: (ctx.leaders || []) as string[] };
  const s = await connect(ctx);
  if (!s.get) throw new Error('Loom has no getLoomVideo tool on this server');
  const ids = items.map((it) => String(it.id || '').toLowerCase());
  const { data: rows } = await svc.from('loom_videos').select('loom_id, status, transcript_id').in('loom_id', ids);
  const known = new Map(((rows || []) as Json[]).map((r) => [String(r.loom_id), r]));
  const cache: { act?: string } = {};
  const addedBy = 'Loom pull (archive, ' + who + ')';
  const out: Json[] = [];
  for (const it of items) {
    const id = String(it.id || '').toLowerCase();
    const dept = String(it.department || '');
    const vis = !it.visibility || it.visibility === 'department' ? null : String(it.visibility);
    const r: Json = { id, department: dept, visibility: vis || 'department' };
    try {
      if (!/^[0-9a-f]{32}$/.test(id)) throw new Error('not a Loom id');
      if (!DEPT_LABEL[dept]) throw new Error('unknown team ' + dept);
      if (vis && ['leadership', 'private', 'speakers'].indexOf(vis) < 0) throw new Error('unknown visibility ' + vis);
      const k = known.get(id) as Json | undefined;
      if (k && (k.status === 'filed' || k.status === 'personal')) { r.status = k.status === 'filed' ? 'already' : 'personal'; r.transcript_id = k.transcript_id || null; out.push(r); continue; }
      if (Date.now() > deadline) { r.status = 'later'; out.push(r); continue; }
      const got = await fetchVideo(s, id, await loomAri(s, id, cache));
      const v = got.meta ? merged(normVideo({ id }), got.meta) : normVideo({ id });
      r.title = v.title; r.date = torontoDay(isoOrNull(v.created) || '');
      if (PERSONAL_TITLE.test(v.title) || personalText(got.tx.lines.join('\n'))) {
        r.status = 'personal'; r.title = '';
        if (!dry) await save(v, { status: 'personal', reason: '' }, [], addedBy);
        out.push(r); continue;
      }
      if (!got.tx.lines.length) {
        r.status = 'no_transcript';
        if (!dry) await save(v, { status: 'skipped', reason: 'Loom has no transcript for it' }, [], addedBy);
        out.push(r); continue;
      }
      /* a meeting for everyone that may hold something sensitive goes to the leaders instead (an admin can open it up) */
      let vis2 = vis;
      if (!vis2 && sensitiveText(v.title + '\n' + got.tx.lines.join('\n'))) { vis2 = 'leadership'; r.raised = 'sensitive, so the leaders see it'; }
      let allowed: string[] | undefined;
      if (vis2 === 'speakers') allowed = speakersAllowed(v.title, got.tx.speakers, roster, v.participants);
      else if (vis2 === 'private') allowed = allowedFor(v, got.tx.speakers, people);
      if ((vis2 === 'speakers' || vis2 === 'private') && (!allowed || !allowed.length)) throw new Error('nobody on the Hub is speaking in it');
      r.visibility = vis2 || 'department'; r.speaker_names = got.tx.speakers.slice(0, 8).map((n) => { const m = matchRoster(n, roster); return m ? m.name : n; });
      r.speakers = got.tx.speakers.length; r.lines = got.tx.lines.length;
      if (allowed) r.people = allowed.filter((x) => x.indexOf('@') < 0);
      const sum = await summarize(v, got.tx.lines, dept);
      r.summary = sum.source; r.summary_chars = sum.text.length;
      if (dry) { r.status = 'would_file'; out.push(r); continue; }
      const why = vis2 === 'speakers' ? 'a one-on-one: only the people speaking in it see it' : (vis2 === 'leadership' ? 'the leaders see it' : (vis2 === 'private' ? 'confidential to the people in it and the leaders' : 'everyone sees it'));
      const dec: Decision = { status: 'filed', reason: 'Kept for the archive and Ask the Hub only, no tasks (' + why + ')', department: dept, visibility: vis2, allowed };
      const f = await rpc('loom_file', { p: filePayload(v, got.tx, dec, addedBy, { archive_only: true, ai_summary: sum.text || null }) }) as Json;
      r.status = f && f.already ? 'already' : 'filed'; r.transcript_id = f ? f.transcript_id : null;
    } catch (e) {
      if (e instanceof McpError && e.kind === 'refused') throw e;
      r.status = 'error'; r.error = String((e as Error).message || e).slice(0, 200);
    }
    out.push(r);
  }
  const tally: Record<string, number> = {};
  out.forEach((x) => { tally[String(x.status)] = (tally[String(x.status)] || 0) + 1; });
  return { ok: true, dry_run: dry, tally, items: out };
}

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const who = await caller(req);
  if (!who) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({})) as Json;
  const action = String(body.action || 'status');
  try {
    if (action === 'status') {
      const { data: runs } = await svc.from('loom_pull_runs').select('*').order('started_at', { ascending: false }).limit(5);
      return json({ ok: true, key: { email: !!(await keyPart('ATLASSIAN_EMAIL')), token: !!(await keyPart('ATLASSIAN_API_TOKEN')), connected: !!(await vaultOnly('LOOM_OAUTH_REFRESH')) }, runs: runs || [] });
    }
    if (action === 'probe') return json({ ok: true, probe: await probe() });
    if (action === 'file') {
      if (who.kind !== 'admin') return json({ error: 'Admins file recordings from the Loom card' }, 403);
      return json(await fileOne(body, who.who));
    }
    if (action === 'backfill') return json(await backfill(body, who.kind === 'admin' ? who.who : 'automation'));
    if (action === 'pull') return json(await pullOne(body, who));   /* v3 (wave237): one recording, from mail-pull's recap email or an admin */
    if (action === 'sync') {
      const why = who.kind === 'admin' ? 'pull now (' + who.who + ')' : String(body.why || 'schedule').slice(0, 60);
      const runId = await rpc('loom_pull_begin', { p_why: why }) as number | null;
      if (!runId) return json({ ok: false, busy: true, error: 'A pull is already running' }, 409);
      const addedBy = who.kind === 'admin' ? 'Loom pull (' + who.who + ')' : 'Loom pull (scheduled)';
      const work = sync(runId, addedBy).then((r) => rpc('loom_pull_finish', { p_run: runId, p_status: r.status, p_counts: r.counts, p_note: r.note }))
        .catch((e) => rpc('loom_pull_finish', { p_run: runId, p_status: 'error', p_counts: {}, p_note: String((e as Error).message || e).slice(0, 500) }).catch(() => null));
      // @ts-ignore EdgeRuntime is provided by the Supabase edge runtime
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) { EdgeRuntime.waitUntil(work); return json({ ok: true, accepted: true, run: runId }, 202); }
      await work;
      const { data: run } = await svc.from('loom_pull_runs').select('*').eq('id', runId).maybeSingle();
      return json({ ok: true, run });
    }
    return json({ error: 'unknown action ' + action }, 400);
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message || e).slice(0, 400) }, 500);
  }
}

if (Deno.env.get('WA_FN_TEST') !== '1') Deno.serve(handler);
export { handler, sync, probe, fileOne, backfill, pullOne, connect, listAll, fetchVideo };
