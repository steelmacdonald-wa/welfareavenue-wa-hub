// wave277, 02/11/26: the social-publish adapters by registry key.
import type { Publisher } from './types.ts';
import { facebook } from './facebook.ts';
import { instagram } from './instagram.ts';
import { threads } from './threads.ts';
import { linkedin } from './linkedin.ts';
import { youtube } from './youtube.ts';
import { tiktok } from './tiktok.ts';

export const ADAPTERS: Record<string, Publisher> = { instagram, facebook, threads, linkedin, tiktok, youtube };
