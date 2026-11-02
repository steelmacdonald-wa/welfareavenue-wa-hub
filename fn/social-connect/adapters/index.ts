// wave277, 02/11/26: the social-connect adapters by registry key.
import type { Adapter } from './types.ts';
import { threads } from './threads.ts';
import { youtube } from './youtube.ts';
import { tiktok } from './tiktok.ts';
import { linkedin } from './linkedin.ts';

export const ADAPTERS: Record<string, Adapter> = { threads, youtube, tiktok, linkedin };
