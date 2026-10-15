// Welfare Avenue: social-dms (v1, 15/10/26, wave251)
// Steel, 14/10/26 (the Meta additions): "Messenger and Instagram DMs in the Studio inbox — read and reply from the Hub, same
// permissions model as comments (marketing team and admins reply; leads delete)." The Content Studio's Messages: the direct
// messages people send Welfare Avenue's Facebook Page (Messenger) and Instagram account, read into social_threads and
// social_messages and answered from the Hub.
// Trigger: social-inbox's sync (cron wa-social-inbox, every 10 minutes) asks for dm_sync; meta-events asks for one person's
// conversation the moment Meta reports a message (wave250); the Hub's Messages page calls the rest.
// Why the poll stays: the app has Standard access to pages_messaging and instagram_manage_messages, and Meta sends live message
// alerts for people without a role on the app only after App Review (Advanced Access); reading every 10 minutes needs neither.
// Instagram refuses more than one conversation per page of results ("reduce the amount of data", 15/10/26), so it is read
// one conversation at a time, newest first, until one is older than the window. With Standard access a long Instagram inbox
// times out after the first page ("too many conversations with users who do not have a role on app. Please request advanced
// access to instagram_manage_messages"): the sync keeps what it read and reports limited: needs_advanced_access.
// Auth: verify_jwt off; x-wa-secret (automation), or a signed-in staff member: wa225_marketing() (the marketing team and
// admins) for every action but dm_archive and dm_unarchive, which are wa225_publisher() (marketing leads and admins): Meta's
// API cannot remove a conversation, so the Hub's "delete" takes it out of the inbox; a new message from the person brings it
// back.
// Actions (POST): status, dm_sync {platform?, participant?, days?}, dm_reply {id, text} (only inside Meta's 24 hours after
//   the person's last message; standard messaging, no message tags), dm_resolve {id}, dm_reopen {id}, dm_read {id},
//   dm_assign {id, to}, dm_archive {id}, dm_unarchive {id}.
// Tables: social_threads, social_messages (write), social_accounts (read), hub_settings studio_dm_sync, change_log (one line
// per action, never the message text). Vault: META_SYSTEM_TOKEN (a Page token is derived from it). Side effects: a reply is
// sent to the person on Messenger or Instagram, only when a person presses Send in the Hub. Nothing else is sent.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const GRAPH = 'https://graph.facebook.com/v23.0';
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
  return data as string;
}
async function secretOrNull(name: string): Promise<string | null> { try { const v = await getSecret(name); return v || null; } catch (_) { return null; } }
type Me = { email: string; name: string; marketing: boolean; publisher: boolean; auto: boolean };
async function caller(req: Request): Promise<Me | null> {
  try { const g = req.headers.get('x-wa-secret'); if (g && g === (await getSecret('WA_TRIGGER_SECRET'))) return { email: 'automation', name: 'automation', marketing: true, publisher: true, auto: true }; } catch (_) { /* no */ }
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data } = await asUser.auth.getUser();
  const email = String(data?.user?.email || '').toLowerCase();
  if (!email) return null;
  const { data: ok } = await asUser.rpc('is_wa_staff'); if (ok !== true) return null;
  const { data: mk } = await asUser.rpc('wa225_marketing');
  const { data: pub } = await asUser.rpc('wa225_publisher');
  const meta = (data?.user?.user_metadata || {}) as Record<string, string>;
  return { email, name: meta.full_name || meta.name || email.split('@')[0], marketing: mk === true, publisher: pub === true, auto: false };
}
async function graph(method: 'GET' | 'POST' | 'DELETE', path: string, token: string, params: Record<string, string> = {}, base = GRAPH): Promise<Any> {
  const u = new URL(path.startsWith('http') ? path : base + (path.startsWith('/') ? path : '/' + path));
  const body = new URLSearchParams();
  for (const k of Object.keys(params)) { if (method === 'POST') body.set(k, params[k]); else u.searchParams.set(k, params[k]); }
  if (method === 'POST') body.set('access_token', token); else if (!u.searchParams.has('access_token')) u.searchParams.set('access_token', token);
  const res = await fetch(u.toString(), method === 'POST' ? { method, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() } : { method });
  const b = await res.json().catch(() => ({}));
  if (!res.ok || b.error) { const e = b.error || {}; throw new Error((e.error_user_msg || e.message || ('HTTP ' + res.status)) + (e.code ? ' (code ' + e.code + ')' : '')); }
  return b;
}
async function meta(): Promise<{ token: string; page: { id: string; token: string } | null; ig: { id: string; handle: string } | null } | null> {
  const token = await secretOrNull('META_SYSTEM_TOKEN'); if (!token) return null;
  const { data: accs } = await svc.from('social_accounts').select('*').in('platform', ['facebook', 'instagram']).in('status', ['connected', 'error']);
  const fb = ((accs || []) as Any[]).find(a => a.platform === 'facebook');
  const ig = ((accs || []) as Any[]).find(a => a.platform === 'instagram');
  let page: { id: string; token: string } | null = null;
  if (fb) { let pt = token; try { const r = await graph('GET', '/' + fb.external_id, token, { fields: 'access_token' }); pt = r.access_token || token; } catch (_) { /* already a page token */ } page = { id: String(fb.external_id), token: pt }; }
  return { token, page, ig: ig ? { id: String(ig.external_id), handle: String(ig.handle || '') } : null };
}
const LIMITS: Record<string, string> = {};
type MetaCtx = { token: string; page: { id: string; token: string } | null; ig: { id: string; handle: string } | null };
const DM_MSG_FIELDS = 'id,message,from,to,created_time,attachments{mime_type,name,file_url,image_data{url,preview_url},video_data{url,preview_url}},sticker,shares{link,name},story';
function attachmentsOf(m: Any): Any[] {
  const out: Any[] = [];
  for (const a of (((m.attachments && m.attachments.data) || []) as Any[])) {
    const url = (a.image_data && (a.image_data.preview_url || a.image_data.url)) || (a.video_data && (a.video_data.preview_url || a.video_data.url)) || a.file_url || null;
    const mt = String(a.mime_type || '');
    out.push({ type: mt.startsWith('image') ? 'image' : (mt.startsWith('video') ? 'video' : (mt.startsWith('audio') ? 'audio' : 'file')), name: a.name || null, url });
  }
  if (m.sticker) out.push({ type: 'sticker', name: null, url: String(m.sticker) });
  for (const sh of (((m.shares && m.shares.data) || []) as Any[])) out.push({ type: 'share', name: sh.name || null, url: sh.link || null });
  if (m.story) out.push({ type: 'story', name: m.story.mention ? 'Mentioned us in their story' : 'Replied to our story', url: (m.story.mention && m.story.mention.link) || (m.story.reply_to && m.story.reply_to.link) || null });
  return out;
}
async function dmConversations(m: MetaCtx, platform: 'facebook' | 'instagram', participant: string | null, days: number): Promise<Any[]> {
  if (!m.page) return [];
  if (platform === 'instagram' && !m.ig) return [];
  const params: Record<string, string> = { platform: platform === 'facebook' ? 'messenger' : 'instagram', fields: 'id,updated_time' + (platform === 'facebook' ? ',unread_count,participants' : ''), limit: platform === 'facebook' ? '25' : '1' };
  if (participant) params.user_id = participant;
  const since = Date.now() - days * 86400000;
  const out: Any[] = [];
  let next: string | null = '/' + m.page.id + '/conversations';
  /* Instagram answers "reduce the amount of data" for more than one conversation a page (15/10/26), so it is read one at a time */
  for (let pageNo = 0; next && pageNo < (platform === 'facebook' ? 8 : 40); pageNo++) {
    let r: Any;
    try { r = next.startsWith('http') ? await graph('GET', next, m.page.token) : await graph('GET', next, m.page.token, params); }
    catch (e) {
      /* With Standard access Meta only lists conversations with people who have a role on the app, and a long Instagram inbox
         times out ("too many conversations with users who do not have a role on app"): keep what was read and say why. */
      const msg = String((e as Error).message || e);
      if (pageNo > 0 || /advanced access|role on app|reduce the amount/i.test(msg)) { LIMITS[platform] = /advanced access|role on app/i.test(msg) ? 'needs_advanced_access' : 'partial'; break; }
      throw e;
    }
    let older = false;
    for (const c of ((r.data || []) as Any[])) { if (!participant && c.updated_time && new Date(c.updated_time).getTime() < since) { older = true; break; } out.push(c); }
    if (older || participant) break;
    next = r.paging && r.paging.next ? String(r.paging.next) : null;
  }
  return out;
}
async function dmStoreConversation(m: MetaCtx, platform: 'facebook' | 'instagram', c: Any): Promise<{ added: number; thread: number | null }> {
  const pg = m.page!; const usId = platform === 'facebook' ? pg.id : m.ig!.id;
  const { data: ex } = await svc.from('social_threads').select('*').eq('platform', platform).eq('external_id', String(c.id)).maybeSingle();
  if (ex && ex.fetched_at && c.updated_time && new Date(ex.fetched_at).getTime() >= new Date(c.updated_time).getTime()) return { added: 0, thread: ex.id };
  let r: Any = null;
  for (const n of [40, 15, 5]) {
    try { r = await graph('GET', '/' + c.id, pg.token, { fields: 'participants,messages.limit(' + n + '){' + DM_MSG_FIELDS + '}' }); break; }
    catch (e) { if (!/reduce the amount of data/i.test(String((e as Error).message)) || n === 5) throw e; }
  }
  const msgs = (((r.messages && r.messages.data) || []) as Any[]).slice().reverse(); // oldest first
  const parts = (((r.participants && r.participants.data) || (c.participants && c.participants.data) || []) as Any[]);
  const isUs = (p: Any) => !!p && (String(p.id) === usId || String(p.id) === pg.id || (!!m.ig && (String(p.id) === m.ig.id || String(p.username || '').toLowerCase() === m.ig.handle.toLowerCase())));
  const other = parts.find(p => !isUs(p)) || (msgs.find(x => x.from && !isUs(x.from)) || {}).from || {};
  const fromUs = (x: Any) => !!x.from && isUs(x.from);
  const last = msgs[msgs.length - 1] || null;
  const inbound = msgs.filter(x => !fromUs(x));
  const lastIn = inbound.length ? inbound[inbound.length - 1].created_time : (ex ? ex.last_inbound_at : null);
  let unread = 0; for (let i = msgs.length - 1; i >= 0 && !fromUs(msgs[i]); i--) unread++;
  const lastFromUs = last ? fromUs(last) : false;
  const now = new Date().toISOString();
  const stillArchived = !!ex && ex.status === 'archived' && !(lastIn && ex.archived_at && new Date(lastIn).getTime() > new Date(ex.archived_at).getTime());
  const status = stillArchived ? 'archived' : (lastFromUs ? 'resolved' : 'open');
  const snippet = last ? String(last.message || (attachmentsOf(last)[0] ? '[' + attachmentsOf(last)[0].type + ']' : '')).slice(0, 140) : null;
  const row: Any = { platform, external_id: String(c.id), participant_id: other.id ? String(other.id) : null, participant_name: other.name || other.username || null, participant_handle: other.username || null,
    last_message_at: last ? last.created_time : (c.updated_time || null), last_inbound_at: lastIn, last_from_us: lastFromUs, last_snippet: snippet, message_count: msgs.length, unread: lastFromUs ? 0 : unread,
    status, fetched_at: now, updated_at: now };
  let threadId: number;
  if (ex) { await svc.from('social_threads').update(row).eq('id', ex.id); threadId = ex.id; }
  else { const ins = await svc.from('social_threads').insert(row).select('id').single(); if (ins.error) throw new Error('thread: ' + ins.error.message); threadId = ins.data.id; }
  const ids = msgs.map(x => String(x.id));
  const { data: have } = ids.length ? await svc.from('social_messages').select('external_id').eq('platform', platform).in('external_id', ids) : { data: [] };
  const known = new Set(((have || []) as Any[]).map(h => String(h.external_id)));
  const fresh = msgs.filter(x => !known.has(String(x.id))).map(x => ({ thread_id: threadId, platform, external_id: String(x.id), from_us: fromUs(x), author_name: fromUs(x) ? 'Welfare Avenue' : (x.from && (x.from.name || x.from.username)) || null,
    text: x.message || null, attachments: attachmentsOf(x), sent_at: x.created_time || null }));
  if (fresh.length) { const ins = await svc.from('social_messages').insert(fresh); if (ins.error) throw new Error('messages: ' + ins.error.message); }
  return { added: fresh.length, thread: threadId };
}
async function dmSync(platforms: Array<'facebook' | 'instagram'>, participant: string | null, days: number): Promise<Any> {
  const m = await meta(); if (!m || !m.page) return { error: 'Meta is not connected' };
  for (const k of Object.keys(LIMITS)) delete LIMITS[k];
  const out: Any = {};
  for (const pl of platforms) {
    try {
      const convs = await dmConversations(m, pl, participant, days);
      let added = 0, threads = 0;
      for (const c of convs) { const r = await dmStoreConversation(m, pl, c); added += r.added; threads++; }
      out[pl] = { conversations: threads, added, ...(LIMITS[pl] ? { limited: LIMITS[pl] } : {}) };
    } catch (e) { out[pl] = { error: String((e as Error).message || e).slice(0, 200) }; }
  }
  return out;
}
async function dmAct(action: string, t: Any, me: Me, body: Any): Promise<Any> {
  const now = new Date().toISOString();
  if (action === 'dm_reply') {
    const text = String(body.text || '').trim(); if (!text) throw new Error('Write the reply first');
    if (text.length > 2000) throw new Error('Messages stop at 2,000 characters');
    if (!t.participant_id) throw new Error('This conversation has no one to answer');
    if (!t.last_inbound_at || Date.now() - new Date(t.last_inbound_at).getTime() > 24 * 3600000) throw new Error('More than 24 hours since their last message: Meta only lets a Page answer within 24 hours. Answer in the Meta Business Suite inbox instead.');
    const m = await meta(); if (!m || !m.page) throw new Error('Meta is not connected');
    const r = await fetch(GRAPH + '/' + m.page.id + '/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + m.page.token },
      body: JSON.stringify({ recipient: { id: t.participant_id }, messaging_type: 'RESPONSE', message: { text } }) });
    const b = await r.json().catch(() => ({}));
    if (!r.ok || b.error) { const e = b.error || {}; throw new Error((e.error_user_msg || e.message || ('HTTP ' + r.status)) + (e.code ? ' (code ' + e.code + ')' : '')); }
    const mid = String(b.message_id || ('hub-' + Date.now()));
    await svc.from('social_messages').insert({ thread_id: t.id, platform: t.platform, external_id: mid, from_us: true, author_name: 'Welfare Avenue', text, attachments: [], sent_at: now, sent_by: me.name });
    await svc.from('social_threads').update({ status: 'resolved', last_from_us: true, last_message_at: now, last_snippet: text.slice(0, 140), unread: 0, replied_at: now, replied_by: me.name, updated_at: now, message_count: Number(t.message_count || 0) + 1 }).eq('id', t.id);
    return { ok: true, id: mid };
  }
  if (action === 'dm_resolve' || action === 'dm_reopen') { await svc.from('social_threads').update({ status: action === 'dm_resolve' ? 'resolved' : 'open', updated_at: now }).eq('id', t.id); return { ok: true }; }
  if (action === 'dm_read') { await svc.from('social_threads').update({ unread: 0, updated_at: now }).eq('id', t.id); return { ok: true }; }
  if (action === 'dm_assign') { await svc.from('social_threads').update({ assigned_to: String(body.to || '').slice(0, 120) || null, updated_at: now }).eq('id', t.id); return { ok: true }; }
  if (action === 'dm_archive') {
    if (!me.publisher) throw new Error('Only marketing leads and admins take a conversation out of the inbox');
    await svc.from('social_threads').update({ status: 'archived', archived_at: now, archived_by: me.name, updated_at: now }).eq('id', t.id); return { ok: true };
  }
  if (action === 'dm_unarchive') { if (!me.publisher) throw new Error('Only marketing leads and admins'); await svc.from('social_threads').update({ status: t.last_from_us ? 'resolved' : 'open', archived_at: null, archived_by: null, updated_at: now }).eq('id', t.id); return { ok: true }; }
  throw new Error('unknown action');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const me = await caller(req);
  if (!me) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({})) as Any;
  const action = String(body.action || 'status');
  try {
    if (action === 'status') { const { data } = await svc.from('hub_settings').select('value').eq('key', 'studio_dm_sync').maybeSingle(); return json({ ok: true, last: data ? data.value : null, can_reply: me.marketing, can_archive: me.publisher }); }
    if (!me.marketing) return json({ error: 'Messages are for the marketing team and admins' }, 403);
    if (action === 'dm_sync') {
      const pl = body.platform === 'facebook' || body.platform === 'instagram' ? [body.platform] : ['facebook', 'instagram'];
      const who = body.participant && /^\d{5,30}$/.test(String(body.participant)) ? String(body.participant) : null;
      const r = await dmSync(pl as Array<'facebook' | 'instagram'>, who, Math.max(1, Math.min(90, Number(body.days) || 14)));
      if (!who) { try { await svc.from('hub_settings').upsert({ key: 'studio_dm_sync', value: { at: new Date().toISOString(), result: r }, updated_at: new Date().toISOString(), updated_by: 'social-dms' }); } catch (_) { /* fine */ } }
      return json({ ok: true, messages: r });
    }
    if (!action.startsWith('dm_')) return json({ error: 'unknown action' }, 400);
    const tid = Number(body.id); if (!tid) return json({ error: 'which conversation?' }, 400);
    const { data: t } = await svc.from('social_threads').select('*').eq('id', tid).maybeSingle();
    if (!t) return json({ error: 'not found' }, 404);
    const r = await dmAct(action, t, me, body);
    try { await svc.from('change_log').insert({ entity_type: 'social_thread', entity_id: String(tid), field: action, old_value: t.status, new_value: action.replace('dm_', '') + ' on ' + t.platform + (action === 'dm_assign' ? ' to ' + String(body.to || 'nobody').slice(0, 60) : ''), changed_by: me.name }); } catch (_) { /* audit */ }
    return json(r);
  } catch (e) {
    return json({ error: String((e as Error).message || e).slice(0, 300) }, 500);
  }
});
