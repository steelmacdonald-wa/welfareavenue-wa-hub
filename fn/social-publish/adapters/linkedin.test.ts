// wave277: the LinkedIn publisher posts photos (one, or two to twenty as multiImage) and one video, and keeps the Make.com
// fallback. Every request goes through a recording fake fetch, so the assertions read the real request bodies.
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert';
import { linkedin, linkedinFinish } from './linkedin.ts';
import { type Caps, images, Manual, Pending, type Post, type PubCtx, videos } from './types.ts';

const CAPS: Caps = { text: true, images: true, max_images: 20, video: true, max_video_s: 600, comments: true, analytics: true, link_in_caption: true };
const ORG = 'urn:li:organization:42';

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };
type Answer = { status?: number; json?: unknown; headers?: Record<string, string | undefined>; bytes?: Uint8Array<ArrayBuffer> };

function post(media: Post['media'], over: Partial<Post> = {}): Post {
  return {
    id: 7, title: 'Winter drive', platforms: ['linkedin'], format: 'post', caption: 'Hello LinkedIn', link_url: null, media, scheduled_at: null, status: 'publishing',
    results: {}, live: {}, error: null, owner: null, published_at: null, updated_at: '', campaign: null, variants: {}, first_comment: null, tags: [],
    approval_status: 'approved', submitted_by: null, approved_by: null, approval_note: null, repeat_rule: null, repeat_of: null, track_links: false, utm: null,
    manual: {}, created_by: null, ...over,
  };
}

function fake(route: (url: string, method: string, n: number) => Answer, secrets: Record<string, string>, conn: Record<string, unknown>) {
  const calls: Call[] = [];
  const sleeps: number[] = [];
  const fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = String(input); const method = String(init?.method || 'GET');
    const b = init?.body;
    const body = b instanceof Uint8Array ? b : (typeof b === 'string' ? (() => { try { return JSON.parse(b); } catch (_) { return b; } })() : b);
    calls.push({ url, method, headers: (init?.headers || {}) as Record<string, string>, body });
    const a = route(url, method, calls.filter(c => c.url === url && c.method === method).length);
    const payload = a.bytes ? a.bytes : JSON.stringify(a.json ?? {});
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(a.headers || {})) if (v !== undefined) headers[k] = v;
    return Promise.resolve(new Response(payload, { status: a.status ?? 200, headers }));
  }) as typeof globalThis.fetch;
  const ctx: PubCtx = {
    fetch,
    getSecret: (n) => secrets[n] ? Promise.resolve(secrets[n]) : Promise.reject(new Error('secret ' + n + ' unavailable')),
    secretOrNull: (n) => Promise.resolve(secrets[n] || null),
    vaultSet: () => Promise.resolve(),
    connections: () => Promise.resolve({ linkedin: conn }),
    capFor: (p) => Promise.resolve(String(p.caption || '')),
    trackLinks: (t) => Promise.resolve(t),
    shortLink: (u) => Promise.resolve(u),
    images, videos,
    sleep: (ms) => { sleeps.push(ms); return Promise.resolve(); },
    targets: null,
  };
  return { ctx, calls, sleeps };
}

const DIRECT = { SOCIAL_LINKEDIN_TOKEN: 'li-tok' };
const CONN = { mode: 'direct', org_urn: ORG };

Deno.test('linkedin: two photos upload twice and post one multiImage with each alt text', async () => {
  let n = 0;
  const { ctx, calls } = fake((url) => {
    if (url.startsWith('https://api.linkedin.com/rest/images?action=initializeUpload')) { n++; return { json: { value: { uploadUrl: 'https://upload.example/img' + n, image: 'urn:li:image:' + n } } }; }
    if (url.startsWith('https://cdn.example/')) return { bytes: new Uint8Array([1, 2, 3]) };
    if (url.startsWith('https://upload.example/')) return { status: 201 };
    if (url === 'https://api.linkedin.com/rest/posts') return { status: 201, headers: { 'x-restli-id': 'urn:li:share:9' } };
    return { status: 404 };
  }, DIRECT, CONN);
  const r = await linkedin.publish(post([{ url: 'https://cdn.example/a.jpg', mime: 'image/jpeg', alt: 'First' }, { url: 'https://cdn.example/b.jpg', mime: 'image/jpeg', alt: 'Second' }]), CAPS, ctx);

  const inits = calls.filter(c => c.url.startsWith('https://api.linkedin.com/rest/images?action=initializeUpload'));
  assertEquals(inits.length, 2);
  assertEquals(inits[0].body, { initializeUploadRequest: { owner: ORG } });
  const puts = calls.filter(c => c.method === 'PUT');
  assertEquals(puts.map(c => c.url), ['https://upload.example/img1', 'https://upload.example/img2']);
  const posts = calls.filter(c => c.url === 'https://api.linkedin.com/rest/posts');
  assertEquals(posts.length, 1);
  const body = posts[0].body as Record<string, any>;
  assertEquals(body.author, ORG);
  assertEquals(body.commentary, 'Hello LinkedIn');
  assertEquals(body.content.multiImage.images.length, 2);
  assertEquals(body.content.multiImage.images, [{ id: 'urn:li:image:1', altText: 'First' }, { id: 'urn:li:image:2', altText: 'Second' }]);
  assertEquals(posts[0].headers['Linkedin-Version'], '202609');
  assertEquals(posts[0].headers['X-Restli-Protocol-Version'], '2.0.0');
  assertEquals(r.id, 'urn:li:share:9');
  assertEquals(r.url, 'https://www.linkedin.com/feed/update/urn:li:share:9');
});

Deno.test('linkedin: one photo posts content.media as before', async () => {
  const { ctx, calls } = fake((url) => {
    if (url.startsWith('https://api.linkedin.com/rest/images?action=initializeUpload')) return { json: { value: { uploadUrl: 'https://upload.example/one', image: 'urn:li:image:1' } } };
    if (url.startsWith('https://cdn.example/')) return { bytes: new Uint8Array([1]) };
    if (url.startsWith('https://upload.example/')) return { status: 201 };
    if (url === 'https://api.linkedin.com/rest/posts') return { status: 201, headers: { 'x-restli-id': 'urn:li:share:1' } };
    return { status: 404 };
  }, DIRECT, CONN);
  await linkedin.publish(post([{ url: 'https://cdn.example/a.jpg', mime: 'image/jpeg', alt: 'Only' }]), CAPS, ctx);
  const body = calls.find(c => c.url === 'https://api.linkedin.com/rest/posts')!.body as Record<string, any>;
  assertEquals(body.content, { media: { id: 'urn:li:image:1', altText: 'Only' } });
});

Deno.test('linkedin: one video initializes with its size, uploads every part, finalizes with the ETags and posts the urn', async () => {
  const file = new Uint8Array(10).map((_, i) => i);
  const VID = 'urn:li:video:C5';
  const { ctx, calls, sleeps } = fake((url, method, n) => {
    if (url === 'https://cdn.example/v.mp4') return { bytes: file };
    if (url === 'https://api.linkedin.com/rest/videos?action=initializeUpload') return { json: { value: { video: VID, uploadToken: '', uploadInstructions: [{ uploadUrl: 'https://up.example/p1', firstByte: 0, lastByte: 5 }, { uploadUrl: 'https://up.example/p2', firstByte: 6, lastByte: 9 }] } } };
    if (url.startsWith('https://up.example/')) return { status: 200, headers: { etag: 'etag-' + url.slice(-2) } };
    if (url === 'https://api.linkedin.com/rest/videos?action=finalizeUpload') return { status: 200 };
    if (url === 'https://api.linkedin.com/rest/videos/' + encodeURIComponent(VID) && method === 'GET') return { json: { status: n < 2 ? 'PROCESSING' : 'AVAILABLE' } };
    if (url === 'https://api.linkedin.com/rest/posts') return { status: 201, headers: { 'x-restli-id': 'urn:li:share:5' } };
    return { status: 404 };
  }, DIRECT, CONN);
  const r = await linkedin.publish(post([{ url: 'https://cdn.example/v.mp4', mime: 'video/mp4' }]), CAPS, ctx);

  const init = calls.find(c => c.url === 'https://api.linkedin.com/rest/videos?action=initializeUpload')!;
  assertEquals(init.method, 'POST');
  assertEquals(init.body, { initializeUploadRequest: { owner: ORG, fileSizeBytes: 10, uploadCaptions: false, uploadThumbnail: false } });
  const puts = calls.filter(c => c.method === 'PUT');
  assertEquals(puts.map(c => c.url), ['https://up.example/p1', 'https://up.example/p2']);
  assertEquals(Array.from(puts[0].body as Uint8Array), [0, 1, 2, 3, 4, 5]);
  assertEquals(Array.from(puts[1].body as Uint8Array), [6, 7, 8, 9]);
  const fin = calls.find(c => c.url === 'https://api.linkedin.com/rest/videos?action=finalizeUpload')!;
  assertEquals(fin.body, { finalizeUploadRequest: { video: VID, uploadToken: '', uploadedPartIds: ['etag-p1', 'etag-p2'] } });
  assertEquals(calls.filter(c => c.url.startsWith('https://api.linkedin.com/rest/videos/urn')).length, 2);
  assertEquals(sleeps, [5000, 5000]);
  const body = calls.find(c => c.url === 'https://api.linkedin.com/rest/posts')!.body as Record<string, any>;
  assertEquals(body.content.media.id, VID);
  assertEquals(body.content.media.title, 'Winter drive');
  assertEquals(r.id, 'urn:li:share:5');
  // the post comes after the finalize
  assert(calls.findIndex(c => c.url.endsWith('finalizeUpload')) < calls.findIndex(c => c.url === 'https://api.linkedin.com/rest/posts'));
});

Deno.test('linkedin: a video still processing after two checks throws Pending with its urn, with nothing posted', async () => {
  const VID = 'urn:li:video:slow';
  const { ctx, calls, sleeps } = fake((url) => {
    if (url === 'https://cdn.example/v.mp4') return { bytes: new Uint8Array(4) };
    if (url === 'https://api.linkedin.com/rest/videos?action=initializeUpload') return { json: { value: { video: VID, uploadToken: '', uploadInstructions: [{ uploadUrl: 'https://up.example/p1', firstByte: 0, lastByte: 3 }] } } };
    if (url.startsWith('https://up.example/')) return { headers: { etag: 'e1' } };
    if (url.endsWith('finalizeUpload')) return { status: 200 };
    if (url.startsWith('https://api.linkedin.com/rest/videos/')) return { json: { status: 'PROCESSING' } };
    return { status: 404 };
  }, DIRECT, CONN);
  const e = await assertRejects(() => linkedin.publish(post([{ url: 'https://cdn.example/v.mp4', mime: 'video/mp4' }]), CAPS, ctx), Pending);
  assertEquals(e.container, VID);
  assertEquals(calls.filter(c => c.method === 'GET' && c.url.startsWith('https://api.linkedin.com/rest/videos/urn')).length, 2);
  assertEquals(sleeps, [5000, 5000]);
  assertEquals(calls.filter(c => c.url === 'https://api.linkedin.com/rest/posts').length, 0);
});

const SLOW = 'urn:li:video:later';
const statusRoute = (status: string) => (url: string, method: string) => {
  if (url === 'https://api.linkedin.com/rest/videos/' + encodeURIComponent(SLOW) && method === 'GET') return { json: { status } };
  if (url === 'https://api.linkedin.com/rest/posts') return { status: 201, headers: { 'x-restli-id': 'urn:li:share:88' } };
  return { status: 404 };
};

Deno.test('linkedinFinish: AVAILABLE posts the video once and returns the post', async () => {
  const { ctx, calls } = fake(statusRoute('AVAILABLE'), DIRECT, CONN);
  const r = await linkedinFinish(ctx, post([{ url: 'https://cdn.example/v.mp4', mime: 'video/mp4' }]), SLOW);
  assertEquals(r, { id: 'urn:li:share:88', url: 'https://www.linkedin.com/feed/update/urn:li:share:88' });
  const posts = calls.filter(c => c.url === 'https://api.linkedin.com/rest/posts');
  assertEquals(posts.length, 1);
  const body = posts[0].body as Record<string, any>;
  assertEquals(body.author, ORG);
  assertEquals(body.commentary, 'Hello LinkedIn');
  assertEquals(body.content, { media: { id: SLOW, title: 'Winter drive' } });
  assertEquals(posts[0].headers['Linkedin-Version'], '202609');
});

Deno.test('linkedinFinish: still PROCESSING answers null and posts nothing', async () => {
  const { ctx, calls } = fake(statusRoute('PROCESSING'), DIRECT, CONN);
  assertEquals(await linkedinFinish(ctx, post([]), SLOW), null);
  assertEquals(calls.length, 1);
  assertEquals(calls.filter(c => c.url === 'https://api.linkedin.com/rest/posts').length, 0);
});

Deno.test('linkedinFinish: PROCESSING_FAILED throws and posts nothing', async () => {
  const { ctx, calls } = fake(statusRoute('PROCESSING_FAILED'), DIRECT, CONN);
  await assertRejects(() => linkedinFinish(ctx, post([]), SLOW), Error, 'LinkedIn could not process the video');
  assertEquals(calls.filter(c => c.url === 'https://api.linkedin.com/rest/posts').length, 0);
});

Deno.test('linkedin: a video and a photo together is a Manual with the reason, and nothing is sent', async () => {
  const { ctx, calls } = fake(() => ({ status: 500 }), DIRECT, CONN);
  const e = await assertRejects(() => linkedin.publish(post([{ url: 'https://cdn.example/v.mp4', mime: 'video/mp4' }, { url: 'https://cdn.example/a.jpg', mime: 'image/jpeg' }]), CAPS, ctx), Manual);
  assertEquals(e.message, 'LinkedIn takes one video, or up to twenty photos, per post');
  assertEquals(calls.length, 0);
});

Deno.test('linkedin: two videos is a Manual; more photos than the registry allows is a Manual naming the limit', async () => {
  const { ctx, calls } = fake(() => ({ status: 500 }), DIRECT, CONN);
  const two = await assertRejects(() => linkedin.publish(post([{ url: 'https://cdn.example/1.mp4', mime: 'video/mp4' }, { url: 'https://cdn.example/2.mp4', mime: 'video/mp4' }]), CAPS, ctx), Manual);
  assertEquals(two.message, 'LinkedIn takes one video, or up to twenty photos, per post');
  const many = await assertRejects(() => linkedin.publish(post([1, 2, 3].map(i => ({ url: 'https://cdn.example/' + i + '.jpg', mime: 'image/jpeg' }))), { ...CAPS, max_images: 2 }, ctx), Manual);
  assertEquals(many.message, 'LinkedIn takes up to 2 photos');
  assertEquals(calls.length, 0);
});

Deno.test('linkedin: no direct token and a hook saved posts to the hook as today', async () => {
  const { ctx, calls } = fake((url) => {
    if (url === 'https://hook.make.example/abc') return { json: { urn: 'urn:li:share:77' } };
    return { status: 404 };
  }, { SOCIAL_MAKE_LINKEDIN_HOOK: 'https://hook.make.example/abc', SOCIAL_MAKE_LINKEDIN_SECRET: 's3' }, { mode: 'make' });
  const r = await linkedin.publish(post([{ url: 'https://cdn.example/a.jpg', mime: 'image/jpeg' }]), CAPS, ctx);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].method, 'POST');
  assertEquals(calls[0].body, { secret: 's3', text: 'Hello LinkedIn', image_url: 'https://cdn.example/a.jpg', post_type: 'image', post_id: 7 });
  assertEquals(r.via, 'make');
  assertEquals(r.id, 'urn:li:share:77');
  assertEquals(r.url, 'https://www.linkedin.com/feed/update/urn:li:share:77');
});

Deno.test('linkedin: nothing connected is the Manual it was', async () => {
  const { ctx } = fake(() => ({ status: 404 }), {}, {});
  const e = await assertRejects(() => linkedin.publish(post([]), CAPS, ctx), Manual);
  assertEquals(e.message, 'LinkedIn is not connected yet');
});

Deno.test('linkedin modeOf: direct, make, reminder', async () => {
  assertEquals(await linkedin.modeOf({ mode: 'direct' }, fake(() => ({}), DIRECT, {}).ctx), 'direct');
  assertEquals(await linkedin.modeOf({ mode: 'direct' }, fake(() => ({}), { SOCIAL_MAKE_LINKEDIN_HOOK: 'h' }, {}).ctx), 'make');
  assertEquals(await linkedin.modeOf({}, fake(() => ({}), {}, {}).ctx), 'reminder');
});

Deno.test('linkedin: a photo that will not download (404) throws with the status and nothing is posted', async () => {
  const { ctx, calls } = fake((url) => {
    if (url.startsWith('https://api.linkedin.com/rest/images?action=initializeUpload')) return { json: { value: { uploadUrl: 'https://upload.example/img1', image: 'urn:li:image:1' } } };
    if (url.startsWith('https://upload.example/')) return { status: 201 };
    if (url === 'https://api.linkedin.com/rest/posts') return { status: 201, headers: { 'x-restli-id': 'urn:li:share:9' } };
    return { status: 404 };
  }, DIRECT, CONN);
  await assertRejects(() => linkedin.publish(post([{ url: 'https://cdn.example/gone.jpg', mime: 'image/jpeg' }]), CAPS, ctx), Error, 'LinkedIn media download: HTTP 404');
  assertEquals(calls.filter(c => c.method === 'PUT').length, 0);
  assertEquals(calls.filter(c => c.url === 'https://api.linkedin.com/rest/posts').length, 0);
});

Deno.test('linkedin: a video that will not download (404) throws with the status and nothing is uploaded or posted', async () => {
  const { ctx, calls } = fake(() => ({ status: 404 }), DIRECT, CONN);
  await assertRejects(() => linkedin.publish(post([{ url: 'https://cdn.example/gone.mp4', mime: 'video/mp4' }]), CAPS, ctx), Error, 'LinkedIn media download: HTTP 404');
  assertEquals(calls.filter(c => c.url.startsWith('https://api.linkedin.com/')).length, 0);
});

Deno.test('linkedin: a 150 MB video is a Manual before any upload call', async () => {
  const big = String(150 * 1024 * 1024);
  const { ctx, calls } = fake((url, method) => {
    if (url === 'https://cdn.example/big.mp4' && method === 'HEAD') return { headers: { 'content-length': big } };
    if (url === 'https://cdn.example/big.mp4') return { bytes: new Uint8Array(4) };
    return { status: 200, json: { value: { video: 'urn:li:video:x', uploadInstructions: [{ uploadUrl: 'https://up.example/p1', firstByte: 0, lastByte: 3 }] } } };
  }, DIRECT, CONN);
  const e = await assertRejects(() => linkedin.publish(post([{ url: 'https://cdn.example/big.mp4', mime: 'video/mp4' }]), CAPS, ctx), Manual);
  assertEquals(e.message, 'LinkedIn video too large to send from the Hub; post it by hand');
  assertEquals(calls.filter(c => c.url.startsWith('https://api.linkedin.com/')).length, 0);
  assertEquals(calls.filter(c => c.url === 'https://cdn.example/big.mp4' && c.method === 'GET').length, 0);
  // media.size, when the post carries it, is enough on its own (no HEAD)
  const s = fake(() => ({ status: 200 }), DIRECT, CONN);
  await assertRejects(() => linkedin.publish(post([{ url: 'https://cdn.example/big.mp4', mime: 'video/mp4', size: 150 * 1024 * 1024 }]), CAPS, s.ctx), Manual);
  assertEquals(s.calls.length, 0);
});

Deno.test('linkedin: Make with two or more photos goes to the reminder and nothing is sent to the hook', async () => {
  const { ctx, calls } = fake(() => ({ json: { urn: 'urn:li:share:77' } }), { SOCIAL_MAKE_LINKEDIN_HOOK: 'https://hook.make.example/abc', SOCIAL_MAKE_LINKEDIN_SECRET: 's3' }, { mode: 'make' });
  const e = await assertRejects(() => linkedin.publish(post([{ url: 'https://cdn.example/a.jpg', mime: 'image/jpeg' }, { url: 'https://cdn.example/b.jpg', mime: 'image/jpeg' }]), CAPS, ctx), Manual);
  assertEquals(e.message, 'Make sends one photo; this post has 2; post it by hand');
  assertEquals(calls.length, 0);
});
