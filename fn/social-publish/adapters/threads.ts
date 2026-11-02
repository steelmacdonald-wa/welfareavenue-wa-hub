// wave277, 02/11/26: Threads text, photos, carousels and videos (moved from social-publish v5, now through ctx).
// threadsTarget and threadsFinish are exported for index.ts, which finishes videos still processing on the next run.
import { type Any, type Conn, firstCommentOf, graph, Manual, Pending, type Post, type Publisher, type PubCtx, THREADS, waitContainer } from './types.ts';

export async function threadsTarget(ctx: PubCtx): Promise<{ token: string; user: string; username: string } | null> {
  const tok = await ctx.secretOrNull('SOCIAL_THREADS_TOKEN'); if (!tok) return null;
  const c = (await ctx.connections()).threads || {};
  if (!c.user_id) return null;
  return { token: tok, user: String(c.user_id), username: String(c.username || '') };
}
async function publishThreads(p: Post, ctx: PubCtx): Promise<{ id: string; url: string }> {
  const t = await threadsTarget(ctx); if (!t) throw new Manual('Threads is not connected');
  const text = await ctx.capFor(p, 'threads'); const imgs = ctx.images(p); const vids = ctx.videos(p);
  let creation = '';
  if (vids.length) { const r = await graph(ctx, 'POST', '/' + t.user + '/threads', t.token, { media_type: 'VIDEO', video_url: vids[0].url, text }, THREADS); creation = String(r.id); if (!(await waitContainer(ctx, creation, t.token, 45000, THREADS))) throw new Pending(creation); }
  else if (imgs.length > 1) {
    const kids: string[] = [];
    for (const m of imgs.slice(0, 20)) { const r = await graph(ctx, 'POST', '/' + t.user + '/threads', t.token, { media_type: 'IMAGE', image_url: m.url, is_carousel_item: 'true' }, THREADS); kids.push(String(r.id)); }
    const r = await graph(ctx, 'POST', '/' + t.user + '/threads', t.token, { media_type: 'CAROUSEL', children: kids.join(','), text }, THREADS); creation = String(r.id);
    await new Promise(res => setTimeout(res, 3000));
  } else if (imgs.length === 1) { const r = await graph(ctx, 'POST', '/' + t.user + '/threads', t.token, { media_type: 'IMAGE', image_url: imgs[0].url, text }, THREADS); creation = String(r.id); await new Promise(res => setTimeout(res, 3000)); }
  else { if (!text) throw new Error('Threads needs words or media'); const r = await graph(ctx, 'POST', '/' + t.user + '/threads', t.token, { media_type: 'TEXT', text }, THREADS); creation = String(r.id); }
  return await threadsFinish(ctx, t, creation, p);
}
export async function threadsFinish(ctx: PubCtx, t: { token: string; user: string; username: string }, creation: string, p?: Post): Promise<{ id: string; url: string }> {
  const pub = await graph(ctx, 'POST', '/' + t.user + '/threads_publish', t.token, { creation_id: creation }, THREADS);
  const id = String(pub.id || ''); if (!id) throw new Error('Threads returned no id');
  let url = 'https://www.threads.net/@' + t.username;
  try { const m = await graph(ctx, 'GET', '/' + id, t.token, { fields: 'permalink' }, THREADS); if (m.permalink) url = m.permalink; } catch (_) { /* fine */ }
  const out: Any = { id, url };
  if (p) {
    const fc = firstCommentOf(p, 'threads');
    if (fc) { try { const r = await graph(ctx, 'POST', '/' + t.user + '/threads', t.token, { media_type: 'TEXT', text: await ctx.trackLinks(fc, p, 'threads'), reply_to_id: id }, THREADS); await new Promise(res => setTimeout(res, 2000)); await graph(ctx, 'POST', '/' + t.user + '/threads_publish', t.token, { creation_id: String(r.id) }, THREADS); out.first_comment = true; } catch (e) { out.first_comment_error = String((e as Error).message).slice(0, 200); } }
  }
  return out;
}

export const threads: Publisher = {
  publish(p, _caps, ctx) { return publishThreads(p, ctx); },
  async modeOf(conn: Conn, ctx) { return (await ctx.secretOrNull('SOCIAL_THREADS_TOKEN')) && (conn || {}).user_id ? 'direct' : 'reminder'; },
};
