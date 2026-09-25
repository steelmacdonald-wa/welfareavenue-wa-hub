// Welfare Avenue: hub-connect (v2, 25/09/26)
// v2: Google Calendar verifies with calendar.events + calendar.readonly (the
//   events scope alone cannot read the calendar itself); Slack resolves the
//   way notify does (wa_slack_ids, then lookupByEmail, then a unique name
//   match) and, when nothing matches, the person picks their own account
//   from the workspace list (actions slack_users, slack_pick).
// Per-person platform connections behind the profile menu's Settings tab.
// Slack: the hub finds the caller's Slack account by email (bot token) so
// hub messages reach their DMs. Google Calendar and Google Drive: the hub acts
// for the caller through the service account's domain-wide delegation (the
// same client id as the hub@ mailbox), so nobody signs in twice; each person
// switches it on here, and the switch is verified live. Actions (POST, staff JWT):
//   {action:'status'}                              connections + a live check
//   {action:'toggle', provider, enabled}           google_calendar | google_drive | slack
//   {action:'rsvp', event_id, response}            accepted | declined | tentative (calendar.events)
//   {action:'drive_recent', limit?, q?}            the caller's recent Drive files (drive.readonly)
// Scopes the delegation entry (client id 107460787452614031265) must carry:
//   gmail.readonly, calendar.readonly, calendar.events, drive.readonly
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const SCOPE: Record<string, string> = {
  google_calendar: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly',
  google_drive: 'https://www.googleapis.com/auth/drive.readonly',
};

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}
async function caller(req: Request): Promise<{ email: string; name: string } | null> {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  if (!email) return null;
  const name = String((data?.user?.user_metadata || {}).full_name || (data?.user?.user_metadata || {}).name || email.split('@')[0]);
  if (email.endsWith('@welfareavenue.com') || email === 'steelmacdonald@gmail.com') return { email, name };
  return null;
}

/* ---- delegated Google token for one person ---- */
function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function pemToDer(pem: string): Uint8Array {
  const body = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const raw = atob(body);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
async function tokenFor(email: string, scope: string): Promise<string> {
  const sa = JSON.parse(await getSecret('GOOGLE_SA_KEY'));
  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64url(enc.encode(JSON.stringify({ iss: sa.client_email, sub: email, scope, aud: sa.token_uri, iat: now, exp: now + 3600 })));
  const signingInput = header + '.' + claims;
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(signingInput)));
  const res = await fetch(sa.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: signingInput + '.' + b64url(sig) }) });
  const body = await res.json();
  if (!body.access_token) {
    const msg = String(body.error_description || body.error || 'delegation failed');
    if (/unauthorized_client|scope/i.test(JSON.stringify(body))) throw new Error('The hub is not yet allowed to use this scope for your account. An admin adds it to the domain-wide delegation entry (client id 107460787452614031265): ' + scope);
    throw new Error('Google refused: ' + msg.slice(0, 200));
  }
  return body.access_token as string;
}
// deno-lint-ignore no-explicit-any
async function gapi(token: string, method: string, url: string, body?: unknown): Promise<any> {
  const res = await fetch(url, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const b = await res.json().catch(() => null);
  if (!res.ok) throw new Error('Google ' + method + ' ' + url.split('?')[0].replace('https://www.googleapis.com', '') + ' -> ' + res.status + ' ' + String((b && b.error && b.error.message) || '').slice(0, 200));
  return b;
}

/* ---- Slack ---- */
type SlackUser = { id: string; name: string; handle: string; title?: string };
function norm(s: string): string { return String(s || '').toLowerCase().replace(/[^a-z]/g, ''); }
// deno-lint-ignore no-explicit-any
function su(u: any): SlackUser { return { id: u.id, name: u.real_name || u.profile?.real_name || u.profile?.display_name || u.name, handle: u.name, title: u.profile?.title || '' }; }
async function slackUsers(): Promise<SlackUser[]> {
  const tok = await getSecret('SLACK_BOT_TOKEN');
  const out: SlackUser[] = [];
  let cursor = '';
  for (let page = 0; page < 6; page++) {
    const res = await fetch('https://slack.com/api/users.list?limit=200' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''), { headers: { Authorization: 'Bearer ' + tok } });
    const b = await res.json();
    if (!b.ok) throw new Error('Slack users.list: ' + String(b.error || 'failed'));
    for (const u of (b.members || [])) { if (u.deleted || u.is_bot || u.id === 'USLACKBOT' || u.is_app_user) continue; out.push(su(u)); }
    cursor = b.response_metadata?.next_cursor || '';
    if (!cursor) break;
  }
  out.sort((x, y) => String(x.name).localeCompare(String(y.name)));
  return out;
}
async function slackInfo(id: string): Promise<SlackUser | null> {
  try {
    const tok = await getSecret('SLACK_BOT_TOKEN');
    const res = await fetch('https://slack.com/api/users.info?user=' + encodeURIComponent(id), { headers: { Authorization: 'Bearer ' + tok } });
    const b = await res.json();
    return b.ok && b.user && !b.user.deleted ? su(b.user) : null;
  } catch (_) { return null; }
}
async function slackLookup(email: string): Promise<SlackUser | null> {
  /* 1. the id table notify uses (seeded and cached) */
  try {
    const { data } = await svc.from('wa_slack_ids').select('slack_id').eq('email', email).maybeSingle();
    if (data?.slack_id) { const u = await slackInfo(String(data.slack_id)); if (u) return u; }
  } catch (_) { /* fine */ }
  /* 2. the profile email */
  try {
    const tok = await getSecret('SLACK_BOT_TOKEN');
    const res = await fetch('https://slack.com/api/users.lookupByEmail?email=' + encodeURIComponent(email), { headers: { Authorization: 'Bearer ' + tok } });
    const b = await res.json();
    if (b.ok && b.user) { const u = su(b.user); await svc.from('wa_slack_ids').upsert({ email, slack_id: u.id, source: 'lookupByEmail', updated_at: new Date().toISOString() }); return u; }
  } catch (_) { /* fine */ }
  /* 3. a unique name match against the roster name */
  try {
    const { data: m } = await svc.from('team_members').select('name').ilike('email', email).maybeSingle();
    const rosterName = String(m?.name || '');
    if (rosterName) {
      const all = await slackUsers();
      const target = norm(rosterName), first = norm(rosterName.split(' ')[0]);
      const hits = all.filter(u => [u.name, u.handle].some(n => norm(n) === target));
      const firstHits = all.filter(u => [u.name, u.handle].some(n => norm(String(n).split(' ')[0]) === first));
      const pick = hits.length === 1 ? hits[0] : (hits.length === 0 && firstHits.length === 1 ? firstHits[0] : null);
      if (pick) { await svc.from('wa_slack_ids').upsert({ email, slack_id: pick.id, source: 'users.list name match', updated_at: new Date().toISOString() }); return pick; }
    }
  } catch (_) { /* fine */ }
  return null;
}

async function upsertConn(email: string, provider: string, patch: Record<string, unknown>) {
  await svc.from('hub_connections').upsert({ email, provider, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'email,provider' });
}
async function conns(email: string) {
  const { data } = await svc.from('hub_connections').select('provider, enabled, scopes, external_id, external_name, meta, last_ok_at, last_error, connected_at').eq('email', email);
  const out: Record<string, unknown> = {};
  (data || []).forEach((c: Record<string, unknown>) => { out[String(c.provider)] = c; });
  return out;
}

async function verify(email: string, provider: string): Promise<{ ok: boolean; error?: string; detail?: string }> {
  try {
    const token = await tokenFor(email, SCOPE[provider]);
    if (provider === 'google_calendar') {
      const r = await gapi(token, 'GET', 'https://www.googleapis.com/calendar/v3/calendars/primary');
      await upsertConn(email, provider, { enabled: true, scopes: SCOPE[provider], external_id: r.id, external_name: r.summary, last_ok_at: new Date().toISOString(), last_error: null });
      return { ok: true, detail: r.summary };
    }
    const r2 = await gapi(token, 'GET', 'https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)');
    await upsertConn(email, provider, { enabled: true, scopes: SCOPE[provider], external_id: r2.user?.emailAddress, external_name: r2.user?.displayName, last_ok_at: new Date().toISOString(), last_error: null });
    return { ok: true, detail: r2.user?.displayName };
  } catch (e) {
    const msg = String(e).slice(0, 300);
    await upsertConn(email, provider, { enabled: false, scopes: SCOPE[provider], last_error: msg });
    return { ok: false, error: msg };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || 'status');
  let me = await caller(req);
  if (!me && action === 'slack_scopes') {
    // the build may ask what the Slack app can do, with the trigger secret
    try { const g = req.headers.get('x-wa-secret'); if (g && g === (await getSecret('WA_TRIGGER_SECRET'))) me = { email: 'automation', name: 'automation' }; } catch (_) { /* no */ }
  }
  if (!me) return json({ error: 'unauthorized' }, 401);
  try {
    if (action === 'status') {
      const c = await conns(me.email);
      if (!c.slack || (!(c.slack as Record<string, unknown>).external_id && (c.slack as Record<string, unknown>).enabled !== false)) {
        const s = await slackLookup(me.email);
        if (s) { await upsertConn(me.email, 'slack', { enabled: true, external_id: s.id, external_name: s.name, meta: { handle: s.handle }, last_ok_at: new Date().toISOString() }); }
      }
      return json({ ok: true, email: me.email, connections: await conns(me.email), delegated_domain: me.email.endsWith('@welfareavenue.com') });
    }
    if (action === 'toggle') {
      const provider = String(body.provider || '');
      const enabled = body.enabled !== false;
      if (provider === 'slack') {
        if (!enabled) { await upsertConn(me.email, 'slack', { enabled: false }); return json({ ok: true }); }
        const s = await slackLookup(me.email);
        if (!s) return json({ ok: false, pick: true, error: 'No Slack account matches ' + me.email + ' by email or name. Choose your account from the list.' });
        await upsertConn(me.email, 'slack', { enabled: true, external_id: s.id, external_name: s.name, meta: { handle: s.handle }, last_ok_at: new Date().toISOString(), last_error: null });
        return json({ ok: true, slack: s });
      }
      if (!SCOPE[provider]) return json({ error: 'unknown provider' }, 400);
      if (!enabled) { await upsertConn(me.email, provider, { enabled: false }); return json({ ok: true }); }
      if (!me.email.endsWith('@welfareavenue.com')) return json({ ok: false, error: 'Google connections work for welfareavenue.com accounts.' });
      const v = await verify(me.email, provider);
      return json({ ok: v.ok, error: v.error, detail: v.detail });
    }
    if (action === 'slack_scopes') {
      // what the Slack app may do today (onboarding needs channels:manage, groups:write, channels:join, users:read.email)
      const tok = await getSecret('SLACK_BOT_TOKEN');
      const res = await fetch('https://slack.com/api/auth.test', { method: 'POST', headers: { Authorization: 'Bearer ' + tok } });
      const info = await res.json().catch(() => ({}));
      const scopes = (res.headers.get('x-oauth-scopes') || '').split(',').map(x => x.trim()).filter(Boolean);
      const need = ['chat:write', 'users:read', 'users:read.email', 'channels:read', 'channels:manage', 'channels:join', 'groups:read', 'groups:write'];
      return json({ ok: !!info.ok, team: info.team || null, bot: info.user || null, scopes, missing: need.filter(n => !scopes.includes(n)), error: info.ok ? null : (info.error || null) });
    }
    if (action === 'slack_users') {
      const list = await slackUsers();
      return json({ ok: true, users: list.map(u => ({ id: u.id, name: u.name, handle: u.handle, title: u.title })) });
    }
    if (action === 'slack_pick') {
      const id = String(body.slack_id || '').trim();
      if (!/^[UW][A-Z0-9]{6,}$/.test(id)) return json({ error: 'slack_id required' }, 400);
      const u = await slackInfo(id);
      if (!u) return json({ ok: false, error: 'That Slack account could not be read.' });
      await svc.from('wa_slack_ids').upsert({ email: me.email, slack_id: u.id, source: 'chosen in Settings', updated_at: new Date().toISOString() });
      await upsertConn(me.email, 'slack', { enabled: true, external_id: u.id, external_name: u.name, meta: { handle: u.handle }, last_ok_at: new Date().toISOString(), last_error: null });
      try { await svc.from('change_log').insert({ entity_type: 'hub_connection', entity_id: me.email, field: 'slack', old_value: null, new_value: u.name + ' (' + u.id + '), chosen in Settings', changed_by: me.email }); } catch (_) { /* audit */ }
      return json({ ok: true, slack: u });
    }
    if (action === 'rsvp') {
      const eventId = String(body.event_id || ''); const response = String(body.response || '');
      if (!eventId || ['accepted', 'declined', 'tentative'].indexOf(response) < 0) return json({ error: 'event_id and response required' }, 400);
      const c = await conns(me.email);
      const cal = c.google_calendar as Record<string, unknown> | undefined;
      if (!cal || cal.enabled === false) return json({ ok: false, error: 'Turn on Google Calendar in Settings first.' });
      const token = await tokenFor(me.email, SCOPE.google_calendar);
      const ev = await gapi(token, 'GET', 'https://www.googleapis.com/calendar/v3/calendars/primary/events/' + encodeURIComponent(eventId));
      const attendees = Array.isArray(ev.attendees) ? ev.attendees : [];
      let found = false;
      // deno-lint-ignore no-explicit-any
      const next = attendees.map((a: any) => { if (String(a.email || '').toLowerCase() === me.email || a.self) { found = true; return { ...a, responseStatus: response }; } return a; });
      if (!found) next.push({ email: me.email, responseStatus: response });
      await gapi(token, 'PATCH', 'https://www.googleapis.com/calendar/v3/calendars/primary/events/' + encodeURIComponent(eventId) + '?sendUpdates=all', { attendees: next });
      try {
        const { data: row } = await svc.from('hub_events').select('id, attendees').eq('id', eventId).maybeSingle();
        if (row && Array.isArray(row.attendees)) {
          // deno-lint-ignore no-explicit-any
          const upd = row.attendees.map((a: any) => String(a.email || '').toLowerCase() === me.email ? { ...a, status: response, responseStatus: response } : a);
          await svc.from('hub_events').update({ attendees: upd }).eq('id', eventId);
        }
      } catch (_) { /* the next sync catches up */ }
      await upsertConn(me.email, 'google_calendar', { last_ok_at: new Date().toISOString(), last_error: null });
      return json({ ok: true, response });
    }
    if (action === 'drive_recent') {
      const c = await conns(me.email);
      const dr = c.google_drive as Record<string, unknown> | undefined;
      if (!dr || dr.enabled === false) return json({ ok: false, error: 'Turn on Google Drive in Settings first.' });
      const token = await tokenFor(me.email, SCOPE.google_drive);
      const q = String(body.q || '').replace(/'/g, "\\'");
      const url = 'https://www.googleapis.com/drive/v3/files?pageSize=' + Math.min(30, Number(body.limit || 12)) + '&orderBy=' + encodeURIComponent(q ? 'modifiedTime desc' : 'viewedByMeTime desc') + '&fields=' + encodeURIComponent('files(id,name,mimeType,modifiedTime,viewedByMeTime,webViewLink,iconLink,owners(displayName))') + '&q=' + encodeURIComponent((q ? "name contains '" + q + "' and " : '') + 'trashed = false');
      const r = await gapi(token, 'GET', url);
      await upsertConn(me.email, 'google_drive', { last_ok_at: new Date().toISOString(), last_error: null });
      return json({ ok: true, files: r.files || [] });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 400) }, 500);
  }
});
