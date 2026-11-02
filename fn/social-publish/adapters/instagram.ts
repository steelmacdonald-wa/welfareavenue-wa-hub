// wave277, 02/11/26: Instagram feed photos, carousels, reels and stories (moved from social-publish v5, now through ctx).
// igFinish is exported for index.ts, which finishes reels still processing on the next run.
import { type Any, firstCommentOf, graph, kindOf, type Media, Pending, type Post, type Publisher, type PubCtx, type Targets, V, waitContainer } from './types.ts';

export async function igFinish(ctx: PubCtx, igId: string, cid: string, tok: string, username: string, p?: Post): Promise<{ id: string; url: string }> {
  const pub = await graph(ctx, 'POST', '/' + igId + '/media_publish', tok, { creation_id: cid });
  const id = String(pub.id || '');
  if (!id) throw new Error('Instagram returned no media id');
  let url = 'https://www.instagram.com/' + (username ? username + '/' : '');
  try { const m = await graph(ctx, 'GET', '/' + id, tok, { fields: 'permalink' }); if (m.permalink) url = m.permalink; } catch (_) { /* fine */ }
  const out: Any = { id, url };
  if (p) {
    const fc = firstCommentOf(p, 'instagram');
    if (fc && kindOf(p, 'instagram') !== 'story') { try { await graph(ctx, 'POST', '/' + id + '/comments', tok, { message: fc }); out.first_comment = true; } catch (e) { out.first_comment_error = String((e as Error).message).slice(0, 200); } }
  }
  return out;
}
function igTags(m: Media): string | null {
  const t = (m.tags || []).filter(x => x && x.username).slice(0, 20).map(x => ({ username: String(x.username).replace(/^@/, ''), x: Math.max(0, Math.min(1, Number(x.x) || 0.5)), y: Math.max(0, Math.min(1, Number(x.y) || 0.5)) }));
  return t.length ? JSON.stringify(t) : null;
}
function igCommon(p: Post, params: Record<string, string>, opt: { collab?: boolean; location?: boolean } = {}) {
  const v = V(p, 'instagram');
  if (opt.location !== false && v.location && v.location.id) params.location_id = String(v.location.id);
  const col = (Array.isArray(v.collaborators) ? v.collaborators : []).map((x: string) => String(x).replace(/^@/, '').trim()).filter(Boolean).slice(0, 3);
  if (opt.collab !== false && col.length) params.collaborators = JSON.stringify(col);
}
async function publishInstagram(p: Post, t: Targets, ctx: PubCtx): Promise<{ id: string; url: string }> {
  if (!t.ig) throw new Error('No Instagram account connected (Content Studio > Connections)');
  const ig = t.ig; const tok = t.page ? t.page.token : t.token; const cap = await ctx.capFor(p, 'instagram'); const imgs = ctx.images(p); const vids = ctx.videos(p); const kind = kindOf(p, 'instagram');
  const v = V(p, 'instagram');
  let creation = '';
  if (kind === 'story') {
    const params: Record<string, string> = { media_type: 'STORIES' };
    if (vids.length) params.video_url = vids[0].url; else if (imgs.length) params.image_url = imgs[0].url; else throw new Error('A story needs a photo or a video');
    const r = await graph(ctx, 'POST', '/' + ig.id + '/media', tok, params);
    creation = String(r.id);
    if (vids.length && !(await waitContainer(ctx, creation, tok, 45000))) throw new Pending(creation);
  } else if (vids.length && (kind === 'reel' || !imgs.length)) {
    const params: Record<string, string> = { media_type: 'REELS', video_url: vids[0].url, caption: cap, share_to_feed: v.share_to_feed === false ? 'false' : 'true' };
    if (v.cover_url) params.cover_url = String(v.cover_url); else if (v.cover_ms != null) params.thumb_offset = String(Math.max(0, Math.round(Number(v.cover_ms) || 0)));
    if (v.audio_name) params.audio_name = String(v.audio_name).slice(0, 80);
    igCommon(p, params);
    const r = await graph(ctx, 'POST', '/' + ig.id + '/media', tok, params);
    creation = String(r.id);
    if (!(await waitContainer(ctx, creation, tok, 45000))) throw new Pending(creation);
  } else if (imgs.length === 1) {
    const params: Record<string, string> = { image_url: imgs[0].url, caption: cap };
    if (imgs[0].alt) params.alt_text = String(imgs[0].alt).slice(0, 1000);
    const tg = igTags(imgs[0]); if (tg) params.user_tags = tg;
    igCommon(p, params);
    const r = await graph(ctx, 'POST', '/' + ig.id + '/media', tok, params);
    creation = String(r.id);
  } else if (imgs.length > 1) {
    const kids: string[] = [];
    for (const m of imgs.slice(0, 10)) {
      const pr: Record<string, string> = { image_url: m.url, is_carousel_item: 'true' };
      if (m.alt) pr.alt_text = String(m.alt).slice(0, 1000);
      const tg = igTags(m); if (tg) pr.user_tags = tg;
      const r = await graph(ctx, 'POST', '/' + ig.id + '/media', tok, pr); kids.push(String(r.id));
    }
    const params: Record<string, string> = { media_type: 'CAROUSEL', children: kids.join(','), caption: cap };
    igCommon(p, params);
    const r = await graph(ctx, 'POST', '/' + ig.id + '/media', tok, params);
    creation = String(r.id);
    if (!(await waitContainer(ctx, creation, tok, 40000))) throw new Pending(creation);
  } else throw new Error('Instagram needs a photo or a video');
  return await igFinish(ctx, ig.id, creation, tok, ig.username, p);
}

export const instagram: Publisher = {
  async publish(p, _caps, ctx) {
    if (!ctx.targets) throw new Error('Publishing to Meta is off: the Meta token is not in the vault');
    return await publishInstagram(p, ctx.targets, ctx);
  },
  modeOf(_conn, ctx) { return Promise.resolve(ctx.metaCan && ctx.metaCan.instagram ? 'direct' : 'reminder'); },
};
