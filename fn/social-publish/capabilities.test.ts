// wave277: capabilities reads the registry: the active platforms, every platform's caps, and a mode for every platform
// a post can name, including an inactive one (Review Focus 1).
import { assert, assertEquals } from 'jsr:@std/assert';
import { capabilitiesOf, type CapCtx } from './capabilities.ts';
import { images, videos } from './adapters/types.ts';

const caps = (max_images: number) => ({ text: true, images: max_images > 0, max_images, video: true, max_video_s: 600, comments: true, analytics: true, link_in_caption: true });
const row = (key: string, label: string, sort: number, max: number, active = true) => ({ key, label, short: label.slice(0, 2), colour: '#000', sort, auth: key === 'facebook' || key === 'instagram' ? 'meta_token' : 'oauth', console_url: '', console_note: '', steps: [], caps: caps(max), scopes: [], modes: {}, active });
const REGISTRY = [
  row('instagram', 'Instagram', 1, 10), row('facebook', 'Facebook', 2, 10), row('threads', 'Threads', 3, 20),
  row('linkedin', 'LinkedIn', 4, 20), row('tiktok', 'TikTok', 5, 0), row('youtube', 'YouTube', 6, 0, false),
];

function fakeCtx(secrets: Record<string, string>, conn: Record<string, unknown>): CapCtx {
  return {
    fetch: (() => Promise.resolve(new Response('{}', { status: 404 }))) as typeof fetch,
    getSecret: (n) => secrets[n] ? Promise.resolve(secrets[n]) : Promise.reject(new Error('no ' + n)),
    secretOrNull: (n) => Promise.resolve(secrets[n] || null),
    vaultSet: () => Promise.resolve(),
    connections: () => Promise.resolve(conn as Record<string, any>),
    capFor: () => Promise.resolve(''),
    trackLinks: (t) => Promise.resolve(t),
    shortLink: (u) => Promise.resolve(u),
    images, videos,
    sleep: () => Promise.resolve(),
    targets: null,
    accounts: () => Promise.resolve([]),
    settings: () => Promise.resolve({ slack_confirm: false }),
    studio: () => Promise.resolve({ hashtag_cap: 5 }),
  };
}

Deno.test('capabilities: active platforms, caps from the registry, a mode for the inactive one', async () => {
  const out = await capabilitiesOf(fakeCtx({ SOCIAL_YOUTUBE_REFRESH: 'r', SOCIAL_YOUTUBE_CLIENT: '{}', SOCIAL_THREADS_TOKEN: 't' }, { threads: { user_id: '1', state: 'x' }, linkedin: { mode: 'direct' } }), REGISTRY as any);
  assertEquals(out.platforms.length, 5);
  assert(!out.platforms.some((p: any) => p.key === 'youtube'));
  assertEquals(out.caps.linkedin.max_images, 20);
  assertEquals(out.mode.youtube, 'direct');
  assertEquals(out.can.youtube, true);
  assertEquals(out.mode.threads, 'direct');
  assertEquals(out.mode.linkedin, 'reminder');
  assertEquals(out.mode.tiktok, 'reminder');
  assertEquals(out.mode.facebook, 'reminder');
  assertEquals(out.mode.instagram, 'reminder');
  // today's shape stays
  assertEquals(out.ok, true);
  assertEquals(out.token, false);
  assertEquals(out.granted, []);
  assertEquals(out.missing, []);
  assertEquals(out.accounts, []);
  assertEquals(out.settings, { slack_confirm: false });
  assertEquals(out.studio, { hashtag_cap: 5 });
  assertEquals(out.connections.threads, { user_id: '1' });
  assertEquals(Object.keys(out.can).sort(), ['facebook', 'instagram', 'linkedin', 'threads', 'tiktok', 'youtube']);
});

Deno.test('capabilities: without the registry every adapter still gets a mode', async () => {
  const out = await capabilitiesOf(fakeCtx({ SOCIAL_TIKTOK_TOKEN: '{}', SOCIAL_TIKTOK_CLIENT: '{}', SOCIAL_MAKE_LINKEDIN_HOOK: 'h' }, {}), []);
  assertEquals(out.platforms, []);
  assertEquals(out.mode.tiktok, 'drafts');
  assertEquals(out.mode.linkedin, 'make');
  assertEquals(Object.keys(out.mode).sort(), ['facebook', 'instagram', 'linkedin', 'threads', 'tiktok', 'youtube']);
});
