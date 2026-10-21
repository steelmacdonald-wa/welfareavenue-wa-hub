// Welfare Avenue: hashtag-watch (v1, 20/10/26, wave262c)
// Kahkashan, 19/10/26 leadership meeting: "one place where we can ... monitor the hashtags, so we can put out a fire before it
// becomes a wildfire" (the OneBagChallenge). Finds public Instagram posts under the hashtags in social_hashtag_watch through the
// Instagram Graph API's hashtag search (ig_hashtag_search once per tag, then recent_media: the last 24 hours, and top_media),
// and keeps them in social_hashtag_posts for the Content Studio's Hashtags section, where the marketing team marks each one.
// Read-only on Instagram: it never comments, likes, reports or posts. Facebook and TikTok offer no hashtag search.
// Trigger: cron wa-hashtag-watch (every 30 minutes, at :07 and :37); Check now in the Studio (the marketing team and admins).
// Auth: verify_jwt off; x-wa-secret, or a signed-in member of the marketing team or an admin (wa225_marketing).
// Actions (POST): sync {tag?} (every active tag, or one).
// Tables: social_hashtag_watch (ig_hashtag_id, last_checked_at, last_error), social_hashtag_posts (insert new posts; update
//   likes and comments; never the review fields), change_log (a line when a sync finds new posts or a tag fails).
// Vault: META_SYSTEM_TOKEN (instagram_basic). Instagram allows 30 different hashtags in 7 days per account.
// Side effects: none outside the Hub (no Slack, no email).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const GRAPH = 'https://graph.facebook.com/v23.0';
const IG_USER = '17841441999408199';   // Welfare Avenue's Instagram business account
const FIELDS = 'id,caption,media_type,permalink,timestamp,like_count,comments_count';
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type Any = any;

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return String(data);
}
async function caller(req: Request): Promise<string | null> {
  try { const g = req.headers.get('x-wa-secret'); if (g && g === (await getSecret('WA_TRIGGER_SECRET'))) return 'automation'; } catch (_) { /* no */ }
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data } = await asUser.auth.getUser();
  const email = String(data?.user?.email || '').toLowerCase(); if (!email) return null;
  const { data: ok } = await asUser.rpc('wa225_marketing');
  return ok === true ? email : null;
}
async function graph(path: string, token: string, params: Record<string, string> = {}): Promise<Any> {
  const u = new URL(GRAPH + path);
  for (const k of Object.keys(params)) u.searchParams.set(k, params[k]);
  const res = await fetch(u.toString(), { headers: { Authorization: 'Bearer ' + token } });
  const b = await res.json().catch(() => ({}));
  if (!res.ok || b.error) { const e = b.error || {}; throw new Error((e.error_user_msg || e.message || ('HTTP ' + res.status)) + (e.code ? ' (code ' + e.code + ')' : '')); }
  return b;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const who = await caller(req);
  if (!who) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || 'sync');
  if (action !== 'sync') return json({ error: 'unknown action' }, 400);
  try {
    const token = await getSecret('META_SYSTEM_TOKEN');
    let q = svc.from('social_hashtag_watch').select('id, tag, ig_hashtag_id').eq('active', true);
    if (body.tag) q = q.eq('tag', String(body.tag).toLowerCase().replace(/[^a-z0-9_]/g, ''));
    const { data: tags, error } = await q;
    if (error) throw new Error(error.message);
    const out: Any[] = [];
    for (const t of (tags || []) as Any[]) {
      const r = { tag: t.tag, found: 0, added: 0, error: null as string | null };
      try {
        let hid = t.ig_hashtag_id as string | null;
        if (!hid) {
          const s = await graph('/ig_hashtag_search', token, { user_id: IG_USER, q: t.tag });
          hid = s.data && s.data[0] ? String(s.data[0].id) : null;
          if (!hid) throw new Error('Instagram does not know this hashtag yet');
          await svc.from('social_hashtag_watch').update({ ig_hashtag_id: hid }).eq('id', t.id);
        }
        const rows: Any[] = [];
        for (const src of ['recent', 'top']) {
          const m = await graph('/' + hid + '/' + src + '_media', token, { user_id: IG_USER, fields: FIELDS, limit: '50' });
          for (const p of (m.data || []) as Any[]) rows.push({ src, p });
        }
        r.found = rows.length;
        const ids = Array.from(new Set(rows.map((x) => String(x.p.id))));
        const { data: known } = ids.length ? await svc.from('social_hashtag_posts').select('media_id').eq('tag', t.tag).in('media_id', ids) : { data: [] };
        const have = new Set(((known || []) as Any[]).map((k) => String(k.media_id)));
        const seen = new Set<string>();
        for (const x of rows) {
          const id = String(x.p.id); if (seen.has(id)) continue; seen.add(id);
          const fields = { like_count: x.p.like_count ?? null, comments_count: x.p.comments_count ?? null };
          if (have.has(id)) { await svc.from('social_hashtag_posts').update(fields).eq('tag', t.tag).eq('media_id', id); continue; }
          const ins = await svc.from('social_hashtag_posts').insert({
            tag: t.tag, media_id: id, permalink: x.p.permalink || null, media_type: x.p.media_type || null,
            caption: x.p.caption ? String(x.p.caption).slice(0, 2000) : null, posted_at: x.p.timestamp || null, source: x.src, ...fields
          });
          if (!ins.error) r.added++;
        }
        await svc.from('social_hashtag_watch').update({ last_checked_at: new Date().toISOString(), last_error: null }).eq('id', t.id);
      } catch (e) {
        r.error = String((e as Error).message || e).slice(0, 300);
        await svc.from('social_hashtag_watch').update({ last_checked_at: new Date().toISOString(), last_error: r.error }).eq('id', t.id);
      }
      out.push(r);
    }
    /* a line only when something new turned up or a tag failed (every 30 minutes would bury the log) */
    if (out.some((r) => r.added || r.error)) try {
      await svc.from('change_log').insert({ entity_type: 'hashtag_watch', entity_id: 'sync', field: 'sync', old_value: null,
        new_value: out.map((r) => '#' + r.tag + ': ' + r.found + ' found, ' + r.added + ' new' + (r.error ? ' (' + r.error + ')' : '')).join('; ') || 'no active hashtags', changed_by: who });
    } catch (_) { /* audit */ }
    return json({ ok: true, tags: out });
  } catch (e) {
    return json({ error: String((e as Error).message || e).slice(0, 400) }, 500);
  }
});
