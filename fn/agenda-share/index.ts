// Welfare Avenue: agenda-share
// Shareable agenda links. Staff create or revoke a link and post the intro to
// Slack; anyone holding the link can read that one agenda and add items to it
// without signing in. The service key is used only inside token-scoped queries,
// so a link never exposes anything beyond its own agenda.
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
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}

async function staff(req: Request): Promise<string> {
  try {
    const given = req.headers.get('x-wa-secret');
    if (given && given === (await getSecret('WA_TRIGGER_SECRET'))) return 'system';
  } catch (_) { /* fall through */ }
  const authHeader = req.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data } = await asUser.auth.getUser();
    const email = (data?.user?.email || '').toLowerCase();
    if (email.endsWith('@welfareavenue.com')) return email;
  }
  return '';
}

async function siteUrl(): Promise<string> {
  const { data } = await svc.from('app_config').select('value').eq('key', 'site_url').maybeSingle();
  let u = data?.value || 'https://wa-exec-dashboard.netlify.app/';
  if (!u.endsWith('/')) u += '/';
  return u;
}

function newToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function prettyDate(d: string | null): string {
  if (!d) return '';
  const p = String(d).slice(0, 10).split('-').map(Number);
  if (p.length !== 3 || !p[0]) return String(d);
  const dt = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  if (isNaN(dt.getTime())) return String(d);
  return DAYS[dt.getUTCDay()] + ' ' + p[2] + ' ' + MONTHS[p[1] - 1] + ' ' + p[0];
}

function clean(s: unknown, max: number): string {
  return String(s ?? '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').trim().slice(0, max);
}

async function itemsFor(agendaId: number) {
  const { data } = await svc
    .from('agenda_items')
    .select('id,kind,title,notes,sort,created_by,source,created_at')
    .eq('agenda_id', agendaId)
    .order('sort');
  return data || [];
}

function autoSummary(items: { title: string }[]): string {
  const n = items.length;
  if (!n) return 'The agenda is open, nothing on it yet.';
  const top = items.slice(0, 3).map((i) => i.title);
  const list = top.length > 1 ? top.slice(0, -1).join(', ') + ' and ' + top[top.length - 1] : top[0];
  if (n === 1) return 'One thing on the list so far: ' + list + '.';
  if (n <= 3) return n + ' things to cover: ' + list + '.';
  return n + ' things to cover, the big ones are ' + list + '.';
}

async function byToken(token: string) {
  if (!token || token.length < 10) return null;
  const { data } = await svc.from('agendas').select('*').eq('share_token', token).maybeSingle();
  return data || null;
}

function slackText(ag: Record<string, unknown>, items: Record<string, unknown>[], summary: string, url: string): string {
  const lines: string[] = [];
  lines.push(':clipboard: *Agenda: ' + String(ag.title || 'Our next meeting') + '*');
  const d = prettyDate(ag.meeting_date as string | null);
  lines.push(d ? 'Meeting: ' + d : 'Meeting date to be confirmed.');
  lines.push('');
  lines.push(summary);
  if (items.length) {
    lines.push('');
    items.slice(0, 12).forEach((i) => lines.push('• ' + String(i.title)));
    if (items.length > 12) lines.push('• plus ' + (items.length - 12) + ' more');
  }
  lines.push('');
  lines.push('Anything you want on this? Click the link and add it at the bottom, no sign in needed.');
  lines.push('<' + url + '|Add to the agenda>');
  return lines.join('\n');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const action = String(body.action || '');
  const site = await siteUrl();

  /* ---------- public, token scoped ---------- */

  if (action === 'get') {
    const a = await byToken(String(body.token || ''));
    if (!a) return json({ error: 'This link is not active anymore.' }, 404);
    const items = await itemsFor(a.id);
    return json({
      ok: true,
      agenda: {
        title: a.title,
        meeting_date: a.meeting_date,
        meeting_date_pretty: prettyDate(a.meeting_date),
        summary: a.summary || autoSummary(items as { title: string }[]),
        status: a.status,
        can_add: a.status !== 'done',
      },
      items: (items as Record<string, unknown>[]).map((i) => ({
        kind: i.kind,
        title: i.title,
        notes: i.notes,
        created_by: i.source === 'shared' ? i.created_by : null,
        shared: i.source === 'shared',
      })),
    });
  }

  if (action === 'add') {
    const a = await byToken(String(body.token || ''));
    if (!a) return json({ error: 'This link is not active anymore.' }, 404);
    if (a.status === 'done') return json({ error: 'This meeting is already archived.' }, 400);
    const title = clean(body.title, 200);
    const notes = clean(body.notes, 1000);
    const name = clean(body.name, 60);
    if (!title) return json({ error: 'Give the item a title.' }, 400);
    if (!name) return json({ error: 'Add your name so the team knows who raised it.' }, 400);
    const existing = await itemsFor(a.id);
    if (existing.length >= 200) return json({ error: 'This agenda is full.' }, 400);
    const maxSort = existing.reduce((m: number, i: Record<string, number>) => Math.max(m, Number(i.sort) || 0), -1);
    const { error } = await svc.from('agenda_items').insert({
      agenda_id: a.id,
      kind: 'topic',
      title,
      notes: notes || null,
      sort: maxSort + 1,
      created_by: name,
      source: 'shared',
    });
    if (error) return json({ error: 'Could not add that, try again.' }, 500);
    await svc.from('agendas').update({ updated_at: new Date().toISOString() }).eq('id', a.id);
    return json({ ok: true });
  }

  /* ---------- staff only ---------- */

  const who = await staff(req);
  if (!who) return json({ error: 'unauthorized' }, 401);
  const agendaId = Number(body.agenda_id || 0);
  if (!agendaId) return json({ error: 'agenda_id required' }, 400);
  const { data: ag } = await svc.from('agendas').select('*').eq('id', agendaId).maybeSingle();
  if (!ag) return json({ error: 'agenda not found' }, 404);

  if (action === 'create_link') {
    let token = ag.share_token;
    if (!token) {
      token = newToken();
      const { error } = await svc
        .from('agendas')
        .update({ share_token: token, share_created_at: new Date().toISOString(), share_by: who })
        .eq('id', agendaId);
      if (error) return json({ error: 'could not create the link' }, 500);
    }
    const items = await itemsFor(agendaId);
    const summary = ag.summary || autoSummary(items as { title: string }[]);
    const url = site + '?a=' + token;
    return json({ ok: true, token, url, summary, message: slackText(ag, items, summary, url) });
  }

  if (action === 'revoke_link') {
    const { error } = await svc.from('agendas').update({ share_token: null }).eq('id', agendaId);
    if (error) return json({ error: 'could not revoke' }, 500);
    return json({ ok: true });
  }

  if (action === 'set_summary') {
    const s = clean(body.summary, 600);
    const { error } = await svc.from('agendas').update({ summary: s || null, updated_at: new Date().toISOString() }).eq('id', agendaId);
    if (error) return json({ error: 'could not save' }, 500);
    return json({ ok: true });
  }

  if (action === 'post_slack') {
    if (!ag.share_token) return json({ error: 'create the link first' }, 400);
    const items = await itemsFor(agendaId);
    const summary = clean(body.summary, 600) || ag.summary || autoSummary(items as { title: string }[]);
    const text = clean(body.message, 3500) || slackText(ag, items, summary, site + '?a=' + ag.share_token);
    let url = '';
    try { url = await getSecret('SLACK_AGENDA_WEBHOOK_URL'); } catch (_) { /* optional */ }
    if (!url) {
      try { url = await getSecret('SLACK_WEBHOOK_URL'); } catch (_) { /* none */ }
    }
    if (!url) return json({ error: 'no Slack webhook configured' }, 400);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return json({ error: 'Slack rejected the post' }, 502);
    return json({ ok: true, posted: true });
  }

  return json({ error: 'unknown action' }, 400);
});
