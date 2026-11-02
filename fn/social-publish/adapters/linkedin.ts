// wave277, 02/11/26: LinkedIn, direct when connected (text, one photo, two to caps.max_images photos as multiImage, or one
// video), else the Make.com webhook (text or one photo, as in v5), else a reminder. A video still processing after two
// checks throws Pending (its urn as the container); linkedinFinish posts it on a later run.
import { type Any, type Conn, type Media, Manual, Pending, type Post, type Publisher, type PubCtx, type Result } from './types.ts';

const API = 'https://api.linkedin.com/rest';
const PAGE = 'https://www.linkedin.com/company/welfareavenue/';
const urlOf = (urn: string) => urn ? 'https://www.linkedin.com/feed/update/' + urn : PAGE;

async function uploadImage(ctx: PubCtx, H: Record<string, string>, tok: string, owner: string, m: Media): Promise<string> {
  const init = await (await ctx.fetch(API + '/images?action=initializeUpload', { method: 'POST', headers: H, body: JSON.stringify({ initializeUploadRequest: { owner } }) })).json();
  const up = init?.value?.uploadUrl; const urn = init?.value?.image;
  if (!up || !urn) throw new Error('LinkedIn image upload failed');
  const bytes = new Uint8Array(await (await ctx.fetch(m.url)).arrayBuffer());
  const put = await ctx.fetch(up, { method: 'PUT', headers: { Authorization: 'Bearer ' + tok }, body: bytes });
  if (!put.ok) throw new Error('LinkedIn image upload: HTTP ' + put.status);
  return String(urn);
}

/* a video's processing state: true when AVAILABLE, false while processing; PROCESSING_FAILED throws */
async function videoReady(ctx: PubCtx, H: Record<string, string>, video: string): Promise<boolean> {
  const s = await (await ctx.fetch(API + '/videos/' + encodeURIComponent(video), { headers: H })).json().catch(() => ({}));
  if (s.status === 'AVAILABLE') return true;
  if (s.status === 'PROCESSING_FAILED') throw new Error('LinkedIn could not process the video' + (s.processingFailureReason ? ' (' + s.processingFailureReason + ')' : ''));
  return false;
}
const headersOf = (tok: string) => ({ Authorization: 'Bearer ' + tok, 'Linkedin-Version': '202609', 'X-Restli-Protocol-Version': '2.0.0', 'Content-Type': 'application/json' });
function postBody(org: string, text: string): Any {
  return { author: org, commentary: text, visibility: 'PUBLIC', distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] }, lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false };
}
function videoContent(p: Post, urn: string): Any {
  const media: Any = { id: urn };
  const title = String(p.title || '').slice(0, 200); if (title) media.title = title;
  return { media };
}
async function createPost(ctx: PubCtx, H: Record<string, string>, body: Any): Promise<Result> {
  const r = await ctx.fetch(API + '/posts', { method: 'POST', headers: H, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('LinkedIn: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const urn = r.headers.get('x-restli-id') || '';
  return { id: urn, url: urlOf(urn) };
}

/* one video: initialize with the size, PUT each part's byte range, finalize with the parts' ETags, then check twice for AVAILABLE */
async function uploadVideo(ctx: PubCtx, H: Record<string, string>, tok: string, owner: string, m: Media): Promise<{ urn: string; ready: boolean }> {
  const bytes = new Uint8Array(await (await ctx.fetch(m.url)).arrayBuffer());
  const ir = await ctx.fetch(API + '/videos?action=initializeUpload', { method: 'POST', headers: H, body: JSON.stringify({ initializeUploadRequest: { owner, fileSizeBytes: bytes.length, uploadCaptions: false, uploadThumbnail: false } }) });
  if (!ir.ok) throw new Error('LinkedIn video upload: HTTP ' + ir.status + ' ' + (await ir.text()).slice(0, 200));
  const init = await ir.json().catch(() => ({}));
  const video = String(init?.value?.video || ''); const parts = (init?.value?.uploadInstructions || []) as Array<{ uploadUrl: string; firstByte: number; lastByte: number }>;
  if (!video || !parts.length) throw new Error('LinkedIn video upload failed');
  const etags: string[] = [];
  for (const u of parts) {
    const put = await ctx.fetch(u.uploadUrl, { method: 'PUT', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/octet-stream' }, body: bytes.slice(Number(u.firstByte), Number(u.lastByte) + 1) });
    if (!put.ok) throw new Error('LinkedIn video upload: HTTP ' + put.status);
    const et = put.headers.get('etag'); if (!et) throw new Error('LinkedIn video upload: no ETag');
    etags.push(et);
  }
  const fin = await ctx.fetch(API + '/videos?action=finalizeUpload', { method: 'POST', headers: H, body: JSON.stringify({ finalizeUploadRequest: { video, uploadToken: String(init?.value?.uploadToken || ''), uploadedPartIds: etags } }) });
  if (!fin.ok) throw new Error('LinkedIn video finalize: HTTP ' + fin.status + ' ' + (await fin.text()).slice(0, 200));
  for (let i = 0; i < 2; i++) {
    await ctx.sleep(5000);
    if (await videoReady(ctx, H, video)) return { urn: video, ready: true };
  }
  return { urn: video, ready: false };
}

/* the next run: one status check; AVAILABLE creates the post, still processing answers null, PROCESSING_FAILED throws */
export async function linkedinFinish(ctx: PubCtx, p: Post, urn: string): Promise<Result | null> {
  const c = (await ctx.connections()).linkedin || {};
  const direct = c.mode === 'direct' ? await ctx.secretOrNull('SOCIAL_LINKEDIN_TOKEN') : null;
  if (!direct || !c.org_urn) throw new Error('LinkedIn is not connected');
  const H = headersOf(direct);
  if (!(await videoReady(ctx, H, urn))) return null;
  const body = postBody(c.org_urn, await ctx.capFor(p, 'linkedin'));
  body.content = videoContent(p, urn);
  return await createPost(ctx, H, body);
}

async function publishLinkedIn(p: Post, caps: { max_images: number }, ctx: PubCtx): Promise<Result> {
  const imgs = ctx.images(p); const vids = ctx.videos(p);
  if (vids.length > 1 || (vids.length && imgs.length)) throw new Manual('LinkedIn takes one video, or up to twenty photos, per post');
  if (imgs.length > caps.max_images) throw new Manual('LinkedIn takes up to ' + caps.max_images + ' photos');
  const c = (await ctx.connections()).linkedin || {};
  const text = await ctx.capFor(p, 'linkedin');
  const direct = c.mode === 'direct' ? await ctx.secretOrNull('SOCIAL_LINKEDIN_TOKEN') : null;
  if (direct && c.org_urn) {
    const H = headersOf(direct);
    const body: Any = postBody(c.org_urn, text);
    if (vids.length) {
      const v = await uploadVideo(ctx, H, direct, c.org_urn, vids[0]);
      if (!v.ready) throw new Pending(v.urn);
      body.content = videoContent(p, v.urn);
    } else if (imgs.length === 1) {
      const urn = await uploadImage(ctx, H, direct, c.org_urn, imgs[0]);
      body.content = { media: { id: urn, altText: String(imgs[0].alt || '').slice(0, 300) } };
    } else if (imgs.length > 1) {
      const list: Array<{ id: string; altText: string }> = [];
      for (const m of imgs) list.push({ id: await uploadImage(ctx, H, direct, c.org_urn, m), altText: String(m.alt || '').slice(0, 300) });
      body.content = { multiImage: { images: list } };
    }
    return await createPost(ctx, H, body);
  }
  const hook = await ctx.secretOrNull('SOCIAL_MAKE_LINKEDIN_HOOK');
  if (hook && !vids.length) {
    const secret = (await ctx.secretOrNull('SOCIAL_MAKE_LINKEDIN_SECRET')) || '';
    const r = await ctx.fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret, text, image_url: imgs[0] ? imgs[0].url : '', post_type: imgs.length ? 'image' : 'text', post_id: p.id }) });
    const raw = await r.text();
    if (!r.ok) throw new Error('Make: HTTP ' + r.status + ' ' + raw.slice(0, 120));
    let b: Any = {}; try { b = JSON.parse(raw); } catch (_) { b = {}; }
    const urn = String(b.urn || b.id || '');
    return { id: urn || 'make-' + Date.now(), url: urlOf(urn), via: 'make' };
  }
  throw new Manual(vids.length ? 'LinkedIn videos are posted by hand' : 'LinkedIn is not connected yet');
}

export const linkedin: Publisher = {
  publish(p, caps, ctx) { return publishLinkedIn(p, caps, ctx); },
  async modeOf(conn: Conn, ctx) {
    if ((conn || {}).mode === 'direct' && await ctx.secretOrNull('SOCIAL_LINKEDIN_TOKEN')) return 'direct';
    if (await ctx.secretOrNull('SOCIAL_MAKE_LINKEDIN_HOOK')) return 'make';
    return 'reminder';
  },
};
