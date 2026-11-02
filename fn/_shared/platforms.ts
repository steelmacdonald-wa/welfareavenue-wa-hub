// wave277, 02/11/26: shared platform registry for the social functions.
// Reads public.studio_platforms (one row per platform: label, auth, caps, scopes, modes)
// so social-connect and social-publish never hard-code a platform list.
// Deploy copies this file beside each function's index.ts as platforms.ts (build/fn.py).

export type Caps = {
  text: boolean;
  images: boolean;
  max_images: number;
  video: boolean;
  max_video_s: number;
  comments: boolean;
  analytics: boolean;
  link_in_caption: boolean;
};

export type Platform = {
  key: string;
  label: string;
  short: string;
  colour: string;
  sort: number;
  auth: 'oauth' | 'meta_token';
  console_url: string;
  console_note: string;
  steps: string[];
  caps: Caps;
  scopes: string[];
  modes: Record<string, string>;
  active: boolean;
};

// Loose on purpose: both functions pass their own service-role client.
type Svc = { from(table: string): any };

let cache: { at: number; list: Platform[] } = { at: 0, list: [] };

export async function platforms(
  svc: Svc,
  opts: { ttlMs?: number; includeInactive?: boolean } = {},
): Promise<Platform[]> {
  const ttl = opts.ttlMs ?? 60000;
  if (!cache.at || Date.now() - cache.at >= ttl) {
    const { data, error } = await svc.from('studio_platforms').select('*').order('sort');
    if (error) throw new Error('studio_platforms: ' + error.message);
    const list = ((data || []) as Platform[]).slice().sort((a, b) => a.sort - b.sort);
    cache = { at: Date.now(), list };
  }
  return opts.includeInactive ? cache.list : cache.list.filter((p) => p.active);
}

export function byKey(list: Platform[]): Record<string, Platform> {
  const out: Record<string, Platform> = {};
  for (const p of list) out[p.key] = p;
  return out;
}

export function names(list: Platform[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of list) out[p.key] = p.label;
  return out;
}
