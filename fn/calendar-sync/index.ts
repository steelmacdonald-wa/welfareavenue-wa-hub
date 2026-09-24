// Welfare Avenue: calendar-sync (v2, 24/09/26)
// v2: time comparisons parse the timestamps (Google returns local offsets);
// all-day events anchor at noon UTC so the calendar day survives the Toronto offset.
// Mirrors the hub@welfareavenue.com Google Calendar into public.hub_events so
// every hub page shows the same meeting times, and each person's home page can
// list exactly the meetings they are invited to (attendees + RSVP status).
// Reads the calendar through the wa-hub-drive service account (vault
// GOOGLE_SA_KEY). The hub@ account must share its calendar with that account
// ("See all event details"); nothing here can write to the calendar.
// Auth: staff JWT or x-wa-secret (cron via public.call_edge).
// Actions:
//   {action:'probe'}   what the service account can see right now (no writes)
//   {action:'sync'}    mirror the window (-7d .. +60d), refresh dept_meta caches
//   {action:'status'}  last sync state and counts
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const DEFAULT_CALENDAR = 'hub@welfareavenue.com';
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

/* ---- Google service-account token (same recipe as drive-pull) ---- */
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
let TOKEN: { value: string; exp: number } | null = null;
let SA_EMAIL = '';
async function googleToken(): Promise<string> {
  if (TOKEN && Date.now() < TOKEN.exp - 60000) return TOKEN.value;
  const sa = JSON.parse(await getSecret('GOOGLE_SA_KEY'));
  SA_EMAIL = sa.client_email || '';
  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64url(enc.encode(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
    aud: sa.token_uri,
    iat: now, exp: now + 3600
  })));
  const signingInput = header + '.' + claims;
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(signingInput)));
  const assertion = signingInput + '.' + b64url(sig);
  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion })
  });
  const body = await res.json();
  if (!body.access_token) throw new Error('Google token exchange failed: ' + JSON.stringify(body).slice(0, 200));
  TOKEN = { value: body.access_token, exp: Date.now() + (body.expires_in || 3600) * 1000 };
  return TOKEN.value;
}

/* ---- Calendar API ---- */
type GEvent = {
  id: string; status?: string; summary?: string; description?: string; location?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  organizer?: { email?: string; displayName?: string };
  attendees?: Array<{ email?: string; displayName?: string; responseStatus?: string; optional?: boolean; organizer?: boolean; self?: boolean; resource?: boolean }>;
  hangoutLink?: string; htmlLink?: string; updated?: string; recurringEventId?: string;
  conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }> };
};
const CAL = 'https://www.googleapis.com/calendar/v3';
async function gget(token: string, path: string): Promise<{ ok: boolean; status: number; body: any }> {
  const res = await fetch(CAL + path, { headers: { Authorization: 'Bearer ' + token } });
  let body: any = null;
  try { body = await res.json(); } catch (_) { body = null; }
  return { ok: res.ok, status: res.status, body };
}
async function listEvents(token: string, calendarId: string, timeMin: string, timeMax: string, cap = 2000): Promise<{ items: GEvent[]; status: number; error?: string; timeZone?: string }> {
  const items: GEvent[] = [];
  let pageToken = '';
  let tz = '';
  for (let p = 0; p < 10 && items.length < cap; p++) {
    const params = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', maxResults: '250', timeMin, timeMax, showDeleted: 'false' });
    if (pageToken) params.set('pageToken', pageToken);
    const r = await gget(token, '/calendars/' + encodeURIComponent(calendarId) + '/events?' + params.toString());
    if (!r.ok) return { items, status: r.status, error: (r.body && r.body.error && r.body.error.message) || ('HTTP ' + r.status) };
    tz = tz || (r.body && r.body.timeZone) || '';
    items.push(...((r.body && r.body.items) || []));
    pageToken = (r.body && r.body.nextPageToken) || '';
    if (!pageToken) break;
  }
  return { items, status: 200, timeZone: tz };
}
function meetLink(ev: GEvent): string {
  if (ev.hangoutLink) return ev.hangoutLink;
  const eps = (ev.conferenceData && ev.conferenceData.entryPoints) || [];
  const v = eps.find(e => e.entryPointType === 'video' && e.uri);
  if (v && v.uri) return v.uri;
  const m = String(ev.description || '').match(/https?:\/\/(?:meet\.google\.com|[a-z0-9.]*zoom\.us|teams\.microsoft\.com)[^\s<"')]+/i);
  return m ? m[0] : '';
}
function toRow(calendarId: string, ev: GEvent, depts: Array<{ department: string; pats: string[] }>) {
  const allDay = !!(ev.start && ev.start.date && !ev.start.dateTime);
  /* all-day events anchor at noon UTC so the calendar day survives the Toronto offset */
  const startAt = ev.start ? (ev.start.dateTime || (ev.start.date ? ev.start.date + 'T12:00:00Z' : null)) : null;
  const endAt = ev.end ? (ev.end.dateTime || (ev.end.date ? ev.end.date + 'T11:00:00Z' : null)) : null;
  const attendees = (ev.attendees || []).filter(a => a.email && !a.resource).map(a => ({
    email: String(a.email).toLowerCase(), name: a.displayName || '', status: a.responseStatus || 'needsAction',
    optional: !!a.optional, organizer: !!a.organizer
  }));
  const title = String(ev.summary || '').toLowerCase();
  let department: string | null = null;
  for (const d of depts) { if (d.pats.some(p => p && title.indexOf(p) >= 0)) { department = d.department; break; } }
  return {
    id: ev.id, calendar_id: calendarId, recurring_event_id: ev.recurringEventId || null,
    summary: ev.summary || '(no title)', description: (ev.description || '').slice(0, 4000), location: ev.location || null,
    start_at: startAt, end_at: endAt, all_day: allDay, status: ev.status || 'confirmed',
    organizer: (ev.organizer && ev.organizer.email ? String(ev.organizer.email).toLowerCase() : null),
    attendees, attendee_emails: attendees.map(a => a.email),
    meet_link: meetLink(ev) || null, html_link: ev.htmlLink || null, department,
    updated_at: ev.updated || null, synced_at: new Date().toISOString()
  };
}

async function deptPatterns(): Promise<Array<{ department: string; pats: string[] }>> {
  const { data } = await svc.from('dept_meta').select('department, calendar_match');
  return (data || []).map((r: { department: string; calendar_match: unknown }) => ({
    department: r.department,
    pats: Array.isArray(r.calendar_match) ? (r.calendar_match as unknown[]).map(p => String(p).toLowerCase()) : []
  }));
}

async function writeState(calendarId: string, ok: boolean, note: string, n: number) {
  try {
    await svc.from('hub_calendar_state').upsert({ calendar_id: calendarId, last_run_at: new Date().toISOString(), last_ok: ok, last_note: note.slice(0, 500), events_n: n, ...(ok ? { last_ok_at: new Date().toISOString() } : {}) });
  } catch (_) { /* state is best effort */ }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let caller = await staffEmail(req);
  if (!caller) {
    try { const g = req.headers.get('x-wa-secret'); if (g && g === (await getSecret('WA_TRIGGER_SECRET'))) caller = 'automation'; } catch (_) { /* no */ }
  }
  if (!caller) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || 'status');
  const calendarId = String(body.calendar_id || DEFAULT_CALENDAR).toLowerCase();
  try {
    if (action === 'status') {
      const { data: st } = await svc.from('hub_calendar_state').select('*').eq('calendar_id', calendarId).maybeSingle();
      const { count } = await svc.from('hub_events').select('id', { count: 'exact', head: true }).eq('calendar_id', calendarId).gte('start_at', new Date().toISOString());
      return json({ calendar_id: calendarId, state: st || null, upcoming_n: count || 0 });
    }
    const token = await googleToken();
    if (action === 'probe') {
      const meta = await gget(token, '/calendars/' + encodeURIComponent(calendarId));
      const now = new Date();
      const ev = await listEvents(token, calendarId, now.toISOString(), new Date(now.getTime() + 30 * 86400000).toISOString(), 20);
      const list = await gget(token, '/users/me/calendarList?maxResults=50');
      const sample = ev.items.slice(0, 8).map(e => ({
        title: e.summary, start: e.start && (e.start.dateTime || e.start.date), attendees: (e.attendees || []).length,
        attendee_sample: (e.attendees || []).slice(0, 4).map(a => (a.email || '') + ':' + (a.responseStatus || '')), link: meetLink(e) ? 'yes' : 'no'
      }));
      const out = {
        service_account: SA_EMAIL,
        calendar: { id: calendarId, readable: meta.ok, status: meta.status, summary: meta.ok ? meta.body.summary : null, timeZone: meta.ok ? meta.body.timeZone : null, error: meta.ok ? null : ((meta.body && meta.body.error && meta.body.error.message) || null) },
        events: { status: ev.status, error: ev.error || null, next30d_n: ev.items.length, with_attendees_n: ev.items.filter(e => (e.attendees || []).length).length, sample },
        visible_calendars: list.ok ? (list.body.items || []).map((c: { id: string; summary: string; accessRole: string }) => ({ id: c.id, summary: c.summary, role: c.accessRole })) : [],
        next_step: meta.ok ? null : 'Share the calendar with ' + SA_EMAIL + ' (Settings > Share with specific people > See all event details), then run probe again.'
      };
      return json(out);
    }
    if (action === 'sync') {
      const now = new Date();
      const timeMin = new Date(now.getTime() - 7 * 86400000).toISOString();
      const timeMax = new Date(now.getTime() + 60 * 86400000).toISOString();
      const ev = await listEvents(token, calendarId, timeMin, timeMax);
      if (ev.status !== 200) {
        await writeState(calendarId, false, 'read failed: ' + (ev.error || ev.status) + ' (share the calendar with ' + SA_EMAIL + ')', 0);
        return json({ error: 'calendar not readable: ' + (ev.error || ev.status), service_account: SA_EMAIL }, 502);
      }
      const depts = await deptPatterns();
      const rows = ev.items.filter(e => e.status !== 'cancelled' && e.id).map(e => toRow(calendarId, e, depts));
      let saved = 0;
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await svc.from('hub_events').upsert(rows.slice(i, i + 200), { onConflict: 'id' });
        if (error) throw new Error('upsert failed: ' + error.message);
        saved += Math.min(200, rows.length - i);
      }
      /* rows in the window that Google no longer returns were cancelled or moved */
      const keep = new Set(rows.map(r => r.id));
      const { data: existing } = await svc.from('hub_events').select('id').eq('calendar_id', calendarId).gte('start_at', timeMin).lte('start_at', timeMax);
      const gone = (existing || []).map((r: { id: string }) => r.id).filter(id => !keep.has(id));
      for (let i = 0; i < gone.length; i += 200) {
        await svc.from('hub_events').delete().in('id', gone.slice(i, i + 200));
      }
      /* refresh the per-department chips the pages already read (dept_meta.meeting_cache) */
      const nowIso = now.toISOString();
      let cached = 0;
      for (const d of depts) {
        const hits = rows.filter(r => r.department === d.department && r.start_at && Date.parse(r.start_at as string) >= now.getTime() && !r.all_day)
          .sort((a, b) => Date.parse(a.start_at as string) - Date.parse(b.start_at as string));
        const seen = new Set<string>();
        const chips: Array<{ title: string; start: string; link: string }> = [];
        for (const h of hits) {
          const t = String(h.summary || '').toLowerCase();
          if (seen.has(t)) continue;
          seen.add(t);
          chips.push({ title: h.summary, start: h.start_at as string, link: h.meet_link || '' });
          if (chips.length >= 2) break;
        }
        if (chips.length) {
          const { error } = await svc.from('dept_meta').update({ meeting_cache: chips, meeting_cache_at: nowIso }).eq('department', d.department);
          if (!error) cached++;
        }
      }
      await writeState(calendarId, true, 'ok: ' + saved + ' events, ' + gone.length + ' removed, ' + cached + ' department chips', saved);
      try {
        await svc.from('change_log').insert({
          entity_type: 'calendar_sync', entity_id: calendarId, field: 'ran', old_value: null,
          new_value: saved + ' events mirrored (' + gone.length + ' removed, ' + cached + ' dept chips refreshed)', changed_by: caller
        });
      } catch (_) { /* audit */ }
      return json({ synced: saved, removed: gone.length, dept_chips: cached, window: { timeMin, timeMax }, timeZone: ev.timeZone || null });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    await writeState(calendarId, false, String(e).slice(0, 300), 0);
    return json({ error: String(e).slice(0, 300) }, 500);
  }
});
