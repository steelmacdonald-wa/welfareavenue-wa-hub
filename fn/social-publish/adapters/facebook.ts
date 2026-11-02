// wave277, 02/11/26: Facebook Page posts, Reels and Stories (moved from social-publish v5, now through ctx).
import { type Any, firstCommentOf, graph, kindOf, type Post, type Publisher, type PubCtx, type Targets, V } from './types.ts';

async function rupload(ctx: PubCtx, videoId: string, fileUrl: string, token: string): Promise<void> {
  const r = await ctx.fetch('https://rupload.facebook.com/video-upload/v23.0/' + videoId, { method: 'POST', headers: { Authorization: 'OAuth ' + token, file_url: fileUrl } });
  const b = await r.json().catch(() => ({}));
  if (!r.ok || b.error || b.success === false) throw new Error('Facebook upload: ' + ((b.error && b.error.message) || ('HTTP ' + r.status)));
}
async function publishFacebook(p: Post, t: Targets, ctx: PubCtx): Promise<{ id: string; url: string }> {
  if (!t.page) throw new Error('No Facebook Page connected (Content Studio > Connections)');
  const pg = t.page; const msg = await ctx.capFor(p, 'facebook'); const imgs = ctx.images(p); const vids = ctx.videos(p); const kind = kindOf(p, 'facebook');
  let id = ''; let url = '';
  if (kind === 'reel') {
    if (!vids.length) throw new Error('A Facebook Reel needs a video');
    const st = await graph(ctx, 'POST', '/' + pg.id + '/video_reels', pg.token, { upload_phase: 'start' });
    const vid = String(st.video_id);
    await rupload(ctx, vid, vids[0].url, pg.token);
    await graph(ctx, 'POST', '/' + pg.id + '/video_reels', pg.token, { upload_phase: 'finish', video_id: vid, video_state: 'PUBLISHED', description: msg });
    id = vid; url = 'https://www.facebook.com/reel/' + vid;
  } else if (kind === 'story') {
    if (vids.length) {
      const st = await graph(ctx, 'POST', '/' + pg.id + '/video_stories', pg.token, { upload_phase: 'start' });
      const vid = String(st.video_id);
      await rupload(ctx, vid, vids[0].url, pg.token);
      const fin = await graph(ctx, 'POST', '/' + pg.id + '/video_stories', pg.token, { upload_phase: 'finish', video_id: vid });
      id = String(fin.post_id || vid);
    } else if (imgs.length) {
      const ph = await graph(ctx, 'POST', '/' + pg.id + '/photos', pg.token, { url: imgs[0].url, published: 'false' });
      const r = await graph(ctx, 'POST', '/' + pg.id + '/photo_stories', pg.token, { photo_id: String(ph.id) });
      id = String(r.post_id || ph.id);
    } else throw new Error('A Facebook story needs a photo or a video');
    url = 'https://www.facebook.com/stories/' + pg.id;
  } else if (vids.length) {
    const r = await graph(ctx, 'POST', '/' + pg.id + '/videos', pg.token, { file_url: vids[0].url, description: msg, title: String(V(p, 'facebook').title || p.title || '').slice(0, 100) });
    id = String(r.id || r.post_id || ''); url = 'https://www.facebook.com/' + pg.id + '/videos/' + id;
  } else if (imgs.length === 1) {
    const params: Record<string, string> = { url: imgs[0].url, message: msg };
    if (imgs[0].alt) params.alt_text_custom = String(imgs[0].alt).slice(0, 1000);
    const r = await graph(ctx, 'POST', '/' + pg.id + '/photos', pg.token, params);
    id = String(r.post_id || r.id || ''); url = 'https://www.facebook.com/' + id;
  } else if (imgs.length > 1) {
    const ids: string[] = [];
    for (const m of imgs.slice(0, 10)) { const pr: Record<string, string> = { url: m.url, published: 'false' }; if (m.alt) pr.alt_text_custom = String(m.alt).slice(0, 1000); const r = await graph(ctx, 'POST', '/' + pg.id + '/photos', pg.token, pr); ids.push(String(r.id)); }
    const params: Record<string, string> = { message: msg };
    ids.forEach((mid, i) => { params['attached_media[' + i + ']'] = JSON.stringify({ media_fbid: mid }); });
    const r = await graph(ctx, 'POST', '/' + pg.id + '/feed', pg.token, params);
    id = String(r.id || ''); url = 'https://www.facebook.com/' + id;
  } else {
    const params: Record<string, string> = { message: msg };
    if (p.link_url) params.link = p.track_links ? await ctx.shortLink(p.link_url, p, 'facebook') : p.link_url;
    if (!msg && !p.link_url) throw new Error('Nothing to post: add a caption, a link or media');
    const r = await graph(ctx, 'POST', '/' + pg.id + '/feed', pg.token, params);
    id = String(r.id || ''); url = 'https://www.facebook.com/' + id;
  }
  if (!id) throw new Error('Facebook returned no post id');
  const fc = firstCommentOf(p, 'facebook');
  if (fc && kind !== 'story') { try { await graph(ctx, 'POST', '/' + id + '/comments', pg.token, { message: await ctx.trackLinks(fc, p, 'facebook') }); } catch (e) { return { id, url, first_comment_error: String((e as Error).message).slice(0, 200) } as Any; } }
  return { id, url };
}

export const facebook: Publisher = {
  async publish(p, _caps, ctx) {
    if (!ctx.targets) throw new Error('Publishing to Meta is off: the Meta token is not in the vault');
    return await publishFacebook(p, ctx.targets, ctx);
  },
  // the Meta token's permissions and the Page decide (capabilities computes them once for both Meta platforms)
  modeOf(_conn, ctx) { return Promise.resolve(ctx.metaCan && ctx.metaCan.facebook ? 'direct' : 'reminder'); },
};
