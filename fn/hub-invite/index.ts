// Welfare Avenue: hub-invite (v3, 24/09/26)
// v3: when a person already has Hub access and the request does not name
//   an access level (bulk invites default to "keep each person's current
//   access"), the existing level is kept instead of being reset to member.
//   Blocked people still need an explicit level from an admin.
// v2 (24/09/26): the People and access module (wave113).
//   - 'invite' also works for LEADERS: they may invite members into their
//     own department only (department and access level are forced server
//     side; a person an admin removed cannot be re-invited by a leader).
//     Admins keep full control. Every invite also tries a Slack DM through
//     notify ('invited'), and send_email:false skips the Supabase
//     invitation email. Response reports email, Slack and whether the
//     profile already existed.
//   - 'bulk_invite': an array of people, each run through the same rules,
//     with a per-person result list.
//   - 'link' (admins): a one-time sign-in link the admin can copy and send
//     anywhere (magic link for an existing account, invite link for a new
//     one). Nothing is emailed by this action.
//   - 'set_email' (admins): put an email on a roster profile that has none,
//     so the person becomes invitable. Uniqueness enforced.
//   - 'remove' unchanged from v1. Everything change_logged.
// v1 (04/08/26): invite (profile + hub_roles + Supabase invite email) and
//   remove (deactivate + block + delete auth user).
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

const FALLBACK_ADMINS = ['steel.macdonald', 'suhaib.abdillahi', 'ian.odhiambo', 'valex.sanon', 'tuna.kaynak', 'michael.michailidis'];
const DEPTS = ['opsmtl', 'opsto', 'marketing', 'fundraising', 'hr', 'board'];
const HUB_ROLES = ['admin', 'leader', 'member', 'viewer'];

type Caller = { email: string; level: 'admin' | 'leader'; department: string | null };

async function getSecret(name: string): Promise<string | null> {
  try {
    const { data } = await svc.rpc('get_secret', { secret_name: name });
    return (data as string) || null;
  } catch (_) { return null; }
}

async function caller(req: Request): Promise<Caller | null> {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  if (!email) return null;
  const { data: role } = await svc.from('hub_roles').select('role').eq('email', email).maybeSingle();
  const isAdmin = role?.role === 'admin' || (email.endsWith('@welfareavenue.com') && FALLBACK_ADMINS.indexOf(email.split('@')[0]) >= 0);
  if (isAdmin) return { email, level: 'admin', department: null };
  if (role?.role === 'leader') {
    const { data: me } = await svc.from('team_members').select('department').ilike('email', email).eq('active', true).maybeSingle();
    return { email, level: 'leader', department: (me?.department as string) || null };
  }
  return null;
}

async function siteUrl(): Promise<string> {
  const { data } = await svc.from('app_config').select('value').eq('key', 'site_url').maybeSingle();
  return data?.value || 'https://wa-exec-dashboard.netlify.app';
}

async function findAuthUser(email: string): Promise<string | null> {
  try {
    let page = 1;
    while (page <= 10) {
      const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 200 });
      if (error || !data?.users?.length) return null;
      const hit = data.users.find(u => (u.email || '').toLowerCase() === email);
      if (hit) return hit.id;
      if (data.users.length < 200) return null;
      page++;
    }
  } catch (_) { /* not found */ }
  return null;
}

async function slackWelcome(memberId: number | null): Promise<string> {
  if (!memberId) return 'skipped';
  try {
    const secret = await getSecret('WA_TRIGGER_SECRET');
    if (!secret) return 'skipped';
    const res = await fetch(SUPABASE_URL + '/functions/v1/notify', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + ANON_KEY, 'apikey': ANON_KEY, 'x-wa-secret': secret, 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'invited', member_id: memberId })
    });
    const body = await res.json().catch(() => ({}));
    return String(body.outcome || body.error || ('http ' + res.status));
  } catch (e) { return 'failed: ' + String(e).slice(0, 80); }
}

type InviteResult = { ok: boolean; email: string; name?: string; error?: string; member_id?: number | null; email_sent?: boolean; note?: string | null; slack?: string; existed?: boolean; hub_role?: string };

async function invite(person: Record<string, unknown>, who: Caller): Promise<InviteResult> {
  const email = String(person.email || '').trim().toLowerCase();
  const name = String(person.name || '').trim();
  let department = String(person.department || '').trim() || null;
  const roleTitle = String(person.role_title || '').trim() || null;
  const sendEmail = person.send_email !== false;
  if (!email || email.indexOf('@') < 1 || /\s/.test(email)) return { ok: false, email, name, error: 'a valid email is required' };
  if (!name) return { ok: false, email, name, error: 'a name is required' };
  if (department && DEPTS.indexOf(department) < 0) department = null;

  const { data: existingRole } = await svc.from('hub_roles').select('role').eq('email', email).maybeSingle();
  const requested = HUB_ROLES.indexOf(String(person.hub_role)) >= 0 ? String(person.hub_role) : null;
  /* explicit level wins; otherwise keep what the person already has; blocked or nothing means member */
  let hubRole = requested || (existingRole && HUB_ROLES.indexOf(existingRole.role) >= 0 ? existingRole.role : 'member');

  if (who.level === 'leader') {
    if (!who.department) return { ok: false, email, name, error: 'your profile has no department, ask an admin' };
    department = who.department;
    hubRole = 'member';
    if (existingRole) {
      if (existingRole.role === 'blocked') return { ok: false, email, name, error: 'this person was removed by an admin; only an admin can invite them again' };
      hubRole = existingRole.role; /* never downgrade someone through a leader invite */
    }
  }

  const { data: existing } = await svc.from('team_members').select('id, active, department').ilike('email', email).maybeSingle();
  let memberId: number | null = existing?.id || null;
  if (who.level === 'leader' && existing && existing.active !== false && existing.department && existing.department !== who.department) {
    return { ok: false, email, name, error: 'this person is on another team; only an admin can invite them' };
  }
  if (existing && existing.active === false) {
    await svc.from('team_members').update({ active: true }).eq('id', existing.id);
  }
  if (!existing) {
    const { data: ins, error: insErr } = await svc.from('team_members')
      .insert({ name, email, department, role: roleTitle, active: true })
      .select('id').single();
    if (insErr) return { ok: false, email, name, error: 'could not create the profile: ' + insErr.message };
    memberId = ins?.id || null;
  }
  await svc.from('hub_roles').upsert({
    email, role: hubRole, updated_by: who.email, updated_at: new Date().toISOString()
  }, { onConflict: 'email' });

  let emailSent = false, emailNote = '';
  if (sendEmail) {
    try {
      const site = await siteUrl();
      const { error: invErr } = await svc.auth.admin.inviteUserByEmail(email, { redirectTo: site, data: { full_name: name } });
      if (invErr) emailNote = invErr.message;
      else emailSent = true;
    } catch (e) { emailNote = String((e as Error).message || e); }
  } else {
    emailNote = 'not requested';
  }
  const slack = await slackWelcome(memberId);

  await svc.from('change_log').insert({
    entity_type: 'member', entity_id: email, field: 'invited',
    old_value: existing ? 'existing profile' : null,
    new_value: hubRole + (emailSent ? ' (email sent)' : ' (email not sent)') + ' (slack ' + slack + ')' + (who.level === 'leader' ? ' by leader' : ''),
    changed_by: who.email
  });
  return { ok: true, email, name, member_id: memberId, email_sent: emailSent, note: emailNote || null, slack, existed: !!existing, hub_role: hubRole };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const who = await caller(req);
  if (!who) return json({ error: 'admins and department leaders only' }, 403);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');

  if (action === 'invite') {
    const r = await invite(body, who);
    return json(r, r.ok ? 200 : 400);
  }

  if (action === 'bulk_invite') {
    const people = Array.isArray(body.people) ? body.people.slice(0, 60) : [];
    if (!people.length) return json({ error: 'no people given' }, 400);
    const results: InviteResult[] = [];
    for (const p of people) {
      if (!p || typeof p !== 'object') continue;
      results.push(await invite(p as Record<string, unknown>, who));
    }
    return json({ ok: true, results, sent: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length });
  }

  if (action === 'link') {
    if (who.level !== 'admin') return json({ error: 'admins only' }, 403);
    const email = String(body.email || '').trim().toLowerCase();
    if (!email || email.indexOf('@') < 1) return json({ error: 'email required' }, 400);
    const site = await siteUrl();
    const uid = await findAuthUser(email);
    try {
      let kind = 'magiclink';
      let res = await svc.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: site } });
      if (res.error && !uid) {
        kind = 'invite';
        const { data: tm } = await svc.from('team_members').select('name').ilike('email', email).maybeSingle();
        res = await svc.auth.admin.generateLink({ type: 'invite', email, options: { redirectTo: site, data: { full_name: tm?.name || '' } } });
      }
      if (res.error) return json({ error: res.error.message }, 400);
      const link = res.data?.properties?.action_link || null;
      if (!link) return json({ error: 'no link returned' }, 500);
      await svc.from('change_log').insert({ entity_type: 'member', entity_id: email, field: 'signin_link', old_value: null, new_value: kind + ' link generated', changed_by: who.email });
      return json({ ok: true, link, kind, existing_account: !!uid });
    } catch (e) { return json({ error: String((e as Error).message || e) }, 500); }
  }

  if (action === 'set_email') {
    if (who.level !== 'admin') return json({ error: 'admins only' }, 403);
    const memberId = Number(body.member_id);
    const email = String(body.email || '').trim().toLowerCase();
    if (!Number.isInteger(memberId) || memberId <= 0) return json({ error: 'member_id required' }, 400);
    if (!email || email.indexOf('@') < 1 || /\s/.test(email)) return json({ error: 'a valid email is required' }, 400);
    const { data: clash } = await svc.from('team_members').select('id, name').ilike('email', email).neq('id', memberId).eq('active', true).maybeSingle();
    if (clash) return json({ error: 'that email already belongs to ' + clash.name }, 400);
    const { data: cur } = await svc.from('team_members').select('email, name').eq('id', memberId).maybeSingle();
    if (!cur) return json({ error: 'profile not found' }, 404);
    const { error: upErr } = await svc.from('team_members').update({ email }).eq('id', memberId);
    if (upErr) return json({ error: 'could not save: ' + upErr.message }, 500);
    await svc.from('change_log').insert({ entity_type: 'member', entity_id: String(memberId), field: 'email', old_value: cur.email || null, new_value: email, changed_by: who.email });
    return json({ ok: true, member_id: memberId, email, name: cur.name });
  }

  if (action === 'remove') {
    if (who.level !== 'admin') return json({ error: 'admins only' }, 403);
    const email = String(body.email || '').trim().toLowerCase();
    if (!email) return json({ error: 'email required' }, 400);
    if (email === who.email) return json({ error: 'you cannot remove yourself' }, 400);

    const { error: e1 } = await svc.from('team_members').update({ active: false }).ilike('email', email);
    if (e1) return json({ error: 'could not deactivate the profile: ' + e1.message }, 500);
    await svc.from('hub_roles').upsert({
      email, role: 'blocked', tabs: null,
      updated_by: who.email, updated_at: new Date().toISOString()
    }, { onConflict: 'email' });
    let authDeleted = false;
    const uid = await findAuthUser(email);
    if (uid) {
      try {
        const { error: dErr } = await svc.auth.admin.deleteUser(uid);
        authDeleted = !dErr;
      } catch (_) { /* leave it */ }
    }
    await svc.from('change_log').insert({
      entity_type: 'member', entity_id: email, field: 'removed',
      old_value: null, new_value: 'blocked' + (authDeleted ? ' (sign-in revoked)' : ''),
      changed_by: who.email
    });
    return json({ ok: true, auth_deleted: authDeleted });
  }

  return json({ error: 'unknown action' }, 400);
});
