// wave277, 02/11/26: TikTok, the video lands in WA's TikTok inbox as a draft (moved from social-publish v5, now through ctx).
import { type Any, Manual, type Post, type Publisher, type PubCtx } from './types.ts';

async function tiktokToken(ctx: PubCtx): Promise<string | null> {
  const raw = await ctx.secretOrNull('SOCIAL_TIKTOK_TOKEN'); const cl = await ctx.secretOrNull('SOCIAL_TIKTOK_CLIENT');
  if (!raw || !cl) return null;
  const t = JSON.parse(raw); const c = JSON.parse(cl);
  if (t.access_token && Number(t.expires_at || 0) > Date.now() + 120000) return String(t.access_token);
  const r = await ctx.fetch('https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_key: c.key || c.id, client_secret: c.secret, grant_type: 'refresh_token', refresh_token: t.refresh_token }).toString() });
  const b = await r.json();
  if (!b.access_token) throw new Error('TikTok sign-in expired: connect TikTok again');
  const next = { ...t, access_token: b.access_token, refresh_token: b.refresh_token || t.refresh_token, expires_at: Date.now() + Number(b.expires_in || 86400) * 1000 };
  await ctx.vaultSet('SOCIAL_TIKTOK_TOKEN', JSON.stringify(next), 'wave225: TikTok login for the Content Studio (social-connect)');
  return String(b.access_token);
}
async function publishTikTok(p: Post, ctx: PubCtx): Promise<{ id: string; url: string }> {
  const vids = ctx.videos(p); if (!vids.length) throw new Manual('TikTok photo posts are posted by hand');
  const tok = await tiktokToken(ctx); if (!tok) throw new Manual('TikTok is not connected');
  const bytes = new Uint8Array(await (await ctx.fetch(vids[0].url)).arrayBuffer());
  const size = bytes.length; const chunk = size <= 64 * 1024 * 1024 ? size : 10 * 1024 * 1024; const count = Math.ceil(size / chunk);
  const init = await (await ctx.fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify({ source_info: { source: 'FILE_UPLOAD', video_size: size, chunk_size: chunk, total_chunk_count: count } }) })).json();
  if (!init?.data?.upload_url) throw new Error('TikTok: ' + (init?.error?.message || 'no upload address'));
  for (let i = 0; i < count; i++) {
    const a = i * chunk, b = Math.min(size, a + chunk) - 1;
    const r = await ctx.fetch(init.data.upload_url, { method: 'PUT', headers: { 'Content-Type': vids[0].mime || 'video/mp4', 'Content-Range': 'bytes ' + a + '-' + b + '/' + size }, body: bytes.slice(a, b + 1) });
    if (!r.ok && r.status !== 206) throw new Error('TikTok upload: HTTP ' + r.status);
  }
  return { id: String(init.data.publish_id), url: 'https://www.tiktok.com/', draft: true } as Any;
}

export const tiktok: Publisher = {
  publish(p, _caps, ctx) { return publishTikTok(p, ctx); },
  async modeOf(_conn, ctx) { return (await ctx.secretOrNull('SOCIAL_TIKTOK_TOKEN')) && (await ctx.secretOrNull('SOCIAL_TIKTOK_CLIENT')) ? 'drafts' : 'reminder'; },
};
