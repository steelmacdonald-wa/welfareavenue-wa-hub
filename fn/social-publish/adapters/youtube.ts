// wave277, 02/11/26: YouTube Shorts by resumable upload with the OAuth refresh token (moved from social-publish v5, now through ctx).
import { type Any, Manual, type Post, type Publisher, type PubCtx, rawCaption, V } from './types.ts';

async function googleToken(ctx: PubCtx): Promise<string | null> {
  const cl = await ctx.secretOrNull('SOCIAL_YOUTUBE_CLIENT'); const rt = await ctx.secretOrNull('SOCIAL_YOUTUBE_REFRESH');
  if (!cl || !rt) return null;
  const c = JSON.parse(cl);
  const r = await ctx.fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: c.id, client_secret: c.secret, refresh_token: rt, grant_type: 'refresh_token' }).toString() });
  const b = await r.json();
  if (!b.access_token) throw new Error('YouTube sign-in expired: connect YouTube again (' + (b.error || r.status) + ')');
  return String(b.access_token);
}
async function publishYouTube(p: Post, ctx: PubCtx): Promise<{ id: string; url: string }> {
  const vids = ctx.videos(p); if (!vids.length) throw new Error('A Short needs a video');
  const tok = await googleToken(ctx); if (!tok) throw new Manual('YouTube is not connected');
  const v = V(p, 'youtube');
  const title = String(v.title || p.title || rawCaption(p, 'youtube').split('\n')[0] || 'Welfare Avenue').slice(0, 100);
  const desc = (await ctx.trackLinks(rawCaption(p, 'youtube'), p, 'youtube')).slice(0, 4900);
  const privacy = ['public', 'unlisted', 'private'].indexOf(String(v.privacy)) >= 0 ? String(v.privacy) : 'public';
  const bytes = new Uint8Array(await (await ctx.fetch(vids[0].url)).arrayBuffer());
  const init = await ctx.fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Length': String(bytes.length), 'X-Upload-Content-Type': vids[0].mime || 'video/mp4' },
    body: JSON.stringify({ snippet: { title, description: desc, categoryId: '29', tags: (p.tags || []).slice(0, 10) }, status: { privacyStatus: privacy, selfDeclaredMadeForKids: !!(v.made_for_kids || v.kids) } })
  });
  const loc = init.headers.get('location');
  if (!init.ok || !loc) throw new Error('YouTube: ' + init.status + ' ' + (await init.text()).slice(0, 200));
  const put = await ctx.fetch(loc, { method: 'PUT', headers: { 'Content-Type': vids[0].mime || 'video/mp4' }, body: bytes });
  const b = await put.json().catch(() => ({}));
  if (!put.ok || !b.id) throw new Error('YouTube upload: ' + put.status + ' ' + JSON.stringify(b).slice(0, 200));
  return { id: String(b.id), url: 'https://youtube.com/shorts/' + b.id, privacy: b.status?.privacyStatus || privacy } as Any;
}

export const youtube: Publisher = {
  publish(p, _caps, ctx) { return publishYouTube(p, ctx); },
  async modeOf(_conn, ctx) { return (await ctx.secretOrNull('SOCIAL_YOUTUBE_REFRESH')) && (await ctx.secretOrNull('SOCIAL_YOUTUBE_CLIENT')) ? 'direct' : 'reminder'; },
};
