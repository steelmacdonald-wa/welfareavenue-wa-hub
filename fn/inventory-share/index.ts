// Welfare Avenue: inventory-share (v2, 06/08/26, Phase 2 S5+S6)
// v1 + link EXPIRY (default 90 days, stored in hub_settings value.expires)
// and RATE LIMITING (per IP+action windows in public.wa_rate_limits).
// - action create_link / revoke_link: staff only (@welfareavenue.com JWT).
// - action list / save: token-gated; token must exist, be enabled and not
//   expired. Invalid-token attempts are rate limited per IP.
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

async function rateOk(key: string, limit: number, windowSec: number): Promise<boolean> {
  const now = new Date();
  const { data } = await svc.from('wa_rate_limits').select('*').eq('key', key).maybeSingle();
  if (!data || (now.getTime() - new Date(data.window_start).getTime()) > windowSec * 1000) {
    await svc.from('wa_rate_limits').upsert({ key, window_start: now.toISOString(), count: 1 });
    return true;
  }
  if (data.count >= limit) return false;
  await svc.from('wa_rate_limits').update({ count: data.count + 1 }).eq('key', key);
  return true;
}
function ip(req: Request): string {
  return (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
}

async function staffEmail(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  return email.endsWith('@welfareavenue.com') ? email : null;
}
async function currentToken(): Promise<{ token: string | null; enabled: boolean; expires: string | null; expired: boolean }> {
  const { data } = await svc.from('hub_settings').select('value').eq('key', 'inventory_share').maybeSingle();
  const v = (data?.value || {}) as { token?: string; enabled?: boolean; expires?: string };
  const expires = v.expires || null;
  const expired = !!expires && new Date(expires).getTime() < Date.now();
  return { token: v.token || null, enabled: v.enabled !== false && !!v.token && !expired, expires, expired };
}
function pageUrl(token: string): string {
  return SUPABASE_URL + '/storage/v1/object/public/web/docs/inventory-editor.html?t=' + token;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');

  if (action === 'create_link' || action === 'revoke_link' || action === 'link_status') {
    if (!(await rateOk('inv:admin:' + ip(req), 20, 600))) return json({ error: 'rate limited' }, 429);
    const email = await staffEmail(req);
    if (!email) return json({ error: 'unauthorized' }, 401);
    if (action === 'link_status') {
      const cur = await currentToken();
      return json({ ok: true, active: cur.enabled, expires: cur.expires, expired: cur.expired });
    }
    if (action === 'revoke_link') {
      await svc.from('hub_settings').upsert({ key: 'inventory_share', value: { token: null, enabled: false, expires: null }, updated_at: new Date().toISOString(), updated_by: email });
      await svc.from('change_log').insert({ entity_type: 'inventory', entity_id: 'share', field: 'link', old_value: 'active', new_value: 'revoked', changed_by: email });
      return json({ ok: true, revoked: true });
    }
    let days = Number(body.days);
    if (!Number.isFinite(days) || days < 1 || days > 365) days = 90;
    let { token } = await currentToken();
    const fresh = !token;
    if (!token) token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const expires = new Date(Date.now() + days * 86400000).toISOString();
    await svc.from('hub_settings').upsert({ key: 'inventory_share', value: { token, enabled: true, expires }, updated_at: new Date().toISOString(), updated_by: email });
    await svc.from('change_log').insert({ entity_type: 'inventory', entity_id: 'share', field: 'link', old_value: fresh ? null : 'renewed', new_value: 'active until ' + expires.slice(0, 10), changed_by: email });
    return json({ ok: true, token, url: pageUrl(token), expires });
  }

  if (!(await rateOk('inv:' + action + ':' + ip(req), 60, 600))) return json({ error: 'rate limited' }, 429);
  const given = String(body.token || '');
  const cur = await currentToken();
  if (!cur.enabled || !given || given !== cur.token) {
    if (!(await rateOk('inv:badtoken:' + ip(req), 15, 600))) return json({ error: 'rate limited' }, 429);
    return json({ error: cur.expired ? 'link expired' : 'invalid or revoked link' }, 403);
  }

  if (action === 'list') {
    const { data, error } = await svc.from('volunteer_inventory').select('id,category,item,unit,qty_in,qty_remaining,reorder_needed,sort').order('sort', { ascending: true });
    if (error) return json({ error: 'load failed' }, 500);
    return json({ ok: true, items: data || [] });
  }

  if (action === 'save') {
    const editor = String(body.editor || 'Volunteer leader').slice(0, 60) || 'Volunteer leader';
    const by = 'Shared link (' + editor + ')';
    const updates = Array.isArray(body.updates) ? body.updates.slice(0, 200) : [];
    const adds = Array.isArray(body.adds) ? body.adds.slice(0, 40) : [];
    let changed = 0, added = 0;
    for (const u of updates) {
      const id = Number((u as Record<string, unknown>).id);
      if (!Number.isInteger(id) || id <= 0) continue;
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const f of ['qty_in', 'qty_remaining', 'reorder_needed']) {
        if (f in (u as Record<string, unknown>)) patch[f] = String((u as Record<string, unknown>)[f] ?? '').slice(0, 120) || null;
      }
      const { error } = await svc.from('volunteer_inventory').update(patch).eq('id', id);
      if (!error) changed++;
    }
    for (const a of adds) {
      const row = a as Record<string, unknown>;
      const item = String(row.item || '').trim().slice(0, 200);
      if (!item) continue;
      const { error } = await svc.from('volunteer_inventory').insert({
        category: String(row.category || '').slice(0, 120) || null,
        item,
        unit: String(row.unit || '').slice(0, 60) || null,
        qty_in: String(row.qty_in || '').slice(0, 120) || null,
        qty_remaining: String(row.qty_remaining || '').slice(0, 120) || null,
        sort: 9000,
        updated_at: new Date().toISOString()
      });
      if (!error) added++;
    }
    if (changed || added) {
      await svc.from('change_log').insert({
        entity_type: 'inventory', entity_id: 'shared-edit', field: 'counts',
        old_value: null, new_value: changed + ' updated, ' + added + ' added', changed_by: by
      });
    }
    return json({ ok: true, updated: changed, added });
  }

  return json({ error: 'unknown action' }, 400);
});
