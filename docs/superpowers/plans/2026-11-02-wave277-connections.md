# wave277 Connections and Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One registry defines every platform; the Connections page shows account health in one list; LinkedIn posts carry up to twenty images or one video; tokens are checked weekly and warned about; approvers are picked from the team.

**Architecture:** A `studio_platforms` table is the single source of truth, read by the front end and by both edge functions through one shared module. Each function keeps one adapter file per platform behind a common interface, and the old switch statements become lookups. wave277 is a new front-end part that replaces wave225's Connections render and event handling through two one-line hooks in wave225, plus a patch to the composer's validation so it reads capabilities instead of per-platform prose.

**Tech Stack:** Plain ES5-style browser JS parts assembled into a seg (Python assemble), Deno TypeScript edge functions on Supabase, Postgres SQL migrations, Playwright drives with the pglite stub.

**Spec:** `docs/superpowers/specs/2026-11-02-wave277-connections-design.md`

## Global Constraints

- Parts in `build/parts277/*.js`, assembled by `build/parts277/assemble.py` (copy of `build/parts225/assemble.py`) to `build/src/277_wave277.seg`; non-ASCII escaped to `\uXXXX`; no em dash (U+2014) or en dash (U+2013) anywhere in a part or a function.
- MANIFEST entry `277_wave277` goes after `225_wave225` and before `110_wave110` in `build/src/MANIFEST.txt`, with a comment line in the same style as `#276_wave276`.
- Run-once flag `window.__wa277`; one IIFE.
- social-connect deploys with `verify_jwt: false`; social-publish and notify keep their current `meta.json` values.
- Copy: Canadian spelling, no dashes, sentence case, plain and specific. Fonts and colours only from the Hub tokens in `build/src/000_head_base.seg:23-44` or wave225's constants (`a_head.js:20`).
- Remove no functionality: every `social-connect` and `social-publish` action that exists today still answers the same body with the same shape, plus any new fields.
- Secrets never appear in a response, a fixture, a test log or a toast.
- Commit after every task on the current branch of this worktree with the attribution line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Review Focus

1. A platform with `active = false` in the registry: the composer must not offer it, the page must not list it, and a post that already names it must still publish or remind as before (Task 2, Task 4, Task 6).
2. A LinkedIn post with one video and one image: the adapter must return Manual with the reason in the spec, never throw and never post half (Task 4).
3. `studio_connections` records written by wave225 before this release have no `health` or `expires_at`: the page must show "Connected" for them, not "Expired" (Task 3, Task 6).
4. A member who is not a publisher opens the Connections page: the keys forms and Connect buttons are hidden, the health is visible, and no call returns 403 into a toast (Task 6).
5. The weekly refresh runs when a platform's health call fails with a network error: the record gets `health: 'error'` and `last_error`, the other platforms are still checked, and no notification is sent for it (Task 3).

---

### Task 1: The platform registry in the database

**Files:**
- Create: `build/data/wa277_connections.sql`
- Test: run through the Supabase connector (`execute_sql`) after `apply_migration`; assertions below

**Interfaces:**
- Produces: table `public.studio_platforms(key text primary key, label text, short text, colour text, sort int, auth text check (auth in ('oauth','meta_token')), console_url text, console_note text, steps jsonb, caps jsonb, scopes text[], modes jsonb, active boolean default true, updated_at timestamptz default now())`; RLS: select for `public.is_wa_staff()`, write for admins (`hub_roles.role = 'admin'`); RPC `public.wa277_platforms() returns setof public.studio_platforms` (stable, security definer, staff only) so the front end gets one call.
- `caps` shape: `{"text":true,"images":true,"max_images":20,"video":true,"max_video_s":600,"comments":true,"analytics":true,"link_in_caption":true}` (booleans and integers only).
- `modes` shape: `{"direct":"Posts directly","drafts":"Lands in TikTok drafts","reminder":"Reminder to post by hand","make":"Posts through Make"}` with only the keys that platform can be in.

- [ ] **Step 1: Write the migration**

Seed six rows from today's values: labels, shorts and colours from `build/parts225/a_head.js:39` (PLX) and `build/src/121_wave121.seg:35-38`; `sort` 1 to 6 in PORDER order; `console_url` and `console_note` from `build/parts225/i_connect.js:3-8` (`CONSOLE`); `steps` from `CX_STEPS` at `i_connect.js:9-15` with the LinkedIn steps replaced by `["Copy the client ID and secret from the LinkedIn app's Auth tab and save them below.", "Press Connect and sign in as an admin of the Welfare Avenue Page."]`; `auth` is `meta_token` for instagram and facebook, `oauth` otherwise. `caps`: instagram `{text, images, max_images 10, video, max_video_s 900, comments, analytics, link_in_caption false}`, facebook `{max_images 10, max_video_s 90 for reels}` use 90, threads `{max_images 20, video, comments true, analytics true}`, linkedin `{max_images 20, video, max_video_s 600, comments true, analytics true}`, tiktok `{images false, video, max_video_s 600, comments false, analytics true}`, youtube `{images false, video, max_video_s 180, comments false, analytics false}`. `scopes`: linkedin `{w_organization_social, r_organization_social, rw_organization_admin, r_organization_social_feed, w_organization_social_feed, r_organization_followers}`, tiktok from `TIKTOK_SCOPES` at `fn/social-connect/index.ts:47`, threads and youtube from `authorizeUrl` at `index.ts:96-97`, instagram and facebook `{}`. `modes`: instagram, facebook, threads, youtube `{direct, reminder}`; tiktok `{drafts, reminder}`; linkedin `{direct, make, reminder}`.

Replace the CHECK constraints at `build/data/wa225_studio.sql:149` (content_slots.platform) and `:185` (social_comments.platform) and `build/data/wa120_social.sql:6` (social_accounts.platform) with `alter table ... drop constraint if exists <name>` followed by `add constraint ..._platform_fk foreign key (platform) references public.studio_platforms(key)`, each guarded so it does not fail if a row holds `csv` (social_accounts uses `external_id = 'csv'`; if any `platform` value is outside the six keys, keep that table's CHECK and write a `raise notice`).

Append a `change_log` row `('wave', 'wave277', 'release', null, 'studio_platforms registry', 'wave277')`.

- [ ] **Step 2: Apply the migration**

Run: `apply_migration` with name `wa277_connections` and the file's content, on project `zwnmulmnvopclzcvytce`.
Expected: success.

- [ ] **Step 3: Verify**

Run: `select key, sort, auth, caps->>'max_images', array_length(scopes,1), active from public.studio_platforms order by sort;`
Expected: six rows in order instagram, facebook, threads, linkedin, tiktok, youtube; linkedin shows `20` and `6`.

Run: `select public.wa277_platforms();` as the service role.
Expected: six rows.

- [ ] **Step 4: Commit**

```bash
git add build/data/wa277_connections.sql
git commit -m "feat(wave277): studio_platforms registry"
```

### Task 2: One shared registry module for the functions

**Files:**
- Create: `fn/_shared/platforms.ts`
- Modify: `build/fn.py` (so `deploy <name>` also uploads `fn/_shared/platforms.ts` as `platforms.ts` beside `index.ts` when the function imports it)
- Test: `fn/_shared/platforms.test.ts` run with `deno test --allow-env fn/_shared/`

**Interfaces:**
- Produces: `export type Platform = { key: string; label: string; short: string; colour: string; sort: number; auth: 'oauth' | 'meta_token'; console_url: string; console_note: string; steps: string[]; caps: Caps; scopes: string[]; modes: Record<string, string>; active: boolean }`; `export type Caps = { text: boolean; images: boolean; max_images: number; video: boolean; max_video_s: number; comments: boolean; analytics: boolean; link_in_caption: boolean }`; `export async function platforms(svc: SupabaseClient, opts?: { ttlMs?: number; includeInactive?: boolean }): Promise<Platform[]>` (cached in module scope for `ttlMs`, default 60000, sorted by `sort`); `export function byKey(list: Platform[]): Record<string, Platform>`; `export function names(list: Platform[]): Record<string, string>` (key to label).
- Consumes: Task 1's table.

- [ ] **Step 1: Write the failing test**

```ts
Deno.test('platforms caches for the ttl and sorts', async () => {
  let calls = 0;
  const svc = fakeSvc(() => { calls++; return [{ key: 'b', sort: 2, active: true }, { key: 'a', sort: 1, active: true }, { key: 'c', sort: 3, active: false }]; });
  const a = await platforms(svc as any, { ttlMs: 1000 }); const b = await platforms(svc as any, { ttlMs: 1000 });
  assertEquals(a.map(p => p.key), ['a', 'b']); assertEquals(calls, 1); assertEquals(b.length, 2);
  const all = await platforms(svc as any, { ttlMs: 0, includeInactive: true }); assertEquals(all.length, 3);
});
```

`fakeSvc` returns an object whose `from('studio_platforms').select('*').order('sort')` resolves `{ data, error: null }`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `deno test --allow-env fn/_shared/`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `fn/_shared/platforms.ts`**

- [ ] **Step 4: Run the test to verify it passes**

Run: `deno test --allow-env fn/_shared/`
Expected: PASS.

- [ ] **Step 5: Make `build/fn.py deploy` include the module**

When `fn/<name>/index.ts` contains `from './platforms.ts'`, upload `fn/_shared/platforms.ts` as `platforms.ts` in the same files list. The Supabase connector's `deploy_edge_function` takes a files array; do the same in the connector call when deploying by hand.

- [ ] **Step 6: Commit**

```bash
git add fn/_shared/platforms.ts fn/_shared/platforms.test.ts build/fn.py
git commit -m "feat(wave277): shared platform registry for the functions"
```

### Task 3: social-connect v3, adapters, health and renewal

**Files:**
- Modify: `fn/social-connect/index.ts` (header, `PLATFORMS`/`NAME` at 44-45, `authorizeUrl` 94-101, `finish` 116-159, `refresh` 213-223, disconnect names 243, `status` 205-212)
- Create: `fn/social-connect/adapters/threads.ts`, `youtube.ts`, `tiktok.ts`, `linkedin.ts`, `fn/social-connect/adapters/types.ts`
- Test: `fn/social-connect/adapters/linkedin.test.ts`, `fn/social-connect/health.test.ts`

**Interfaces:**
- Produces (`adapters/types.ts`): `export type Conn = { status?: string; mode?: string; name?: string; handle?: string; account_id?: string; scopes_granted?: string[]; connected_by?: string; connected_at?: string; expires_at?: string | null; last_checked_at?: string; last_error?: string | null; health?: 'ok' | 'expiring' | 'expired' | 'error' | 'not_connected'; warned_at?: string | null; [k: string]: unknown }`; `export type Adapter = { authorizeUrl(p: Platform, id: string, redirect: string, state: string): string; finish(p: Platform, c: { id: string; secret: string }, code: string, redirect: string, by: string, ctx: Ctx): Promise<{ label: string; conn: Partial<Conn> }>; refresh?(p: Platform, conn: Conn, ctx: Ctx): Promise<Partial<Conn>>; health(p: Platform, conn: Conn, ctx: Ctx): Promise<Partial<Conn>> }`; `export type Ctx = { getSecret(n: string): Promise<string>; secretOrNull(n: string): Promise<string | null>; vaultSet(n: string, v: string, note: string): Promise<void>; svc: SupabaseClient; now(): number }`.
- `status` response gains `platforms: Platform[]` (active only) and every `connections[key]` is a `Conn` with `health` computed on read: `not_connected` when status is not `connected`; `expired` when `expires_at` is past; `expiring` when within 7 days; `error` when `last_error` is set and `last_checked_at` is newer than `connected_at`; else `ok`. A record with no `expires_at` and status `connected` is `ok` (Review Focus 3).
- `finish` for LinkedIn stores `scopes_granted` from the token response's `scope` (space separated), `expires_at` from `expires_in`, `account_id` = `org_urn`.
- New action `health` (publisher): runs every adapter's `health`, writes the records, returns `status`.
- `refresh` (automation): for each active oauth platform with a connected record, call `refresh` when the adapter has one, then `health`; on any thrown error write `{ health: 'error', last_error: message.slice(0, 200), last_checked_at }` and continue (Review Focus 5). After the loop, for each record with `health === 'expiring'` whose `warned_at` is older than 7 days or null, call `notify` with `{ event: 'connection_expiring', to: publishers, title, text, url: '/#studio/connections', tag: 'studio-conn-' + key }` using the trigger secret, then set `warned_at`. Publishers come from `wa241_approvers()` plus admins (one RPC: add `public.wa277_publishers() returns text[]` to Task 1's SQL: admins union `wa241_approvers()`).
- Consumes: Task 2 `platforms`, `byKey`, `names`.

- [ ] **Step 1: Write the failing tests**

`linkedin.test.ts`: `authorizeUrl` contains `scope=` with the six scopes URL-encoded and space separated, and `redirect_uri=` equal to the encoded redirect. `finish` with a fake fetch answering the token call `{ access_token: 't', expires_in: 5184000, scope: 'w_organization_social r_organization_social' }` and the ACL call `{ elements: [{ organization: 'urn:li:organization:1' }] }` returns `conn.scopes_granted = ['w_organization_social','r_organization_social']`, `conn.expires_at` within a minute of now plus 60 days, `conn.account_id = 'urn:li:organization:1'`.

`health.test.ts`: a pure `healthOf(conn: Conn, now: number): Conn['health']` exported from `index.ts` (or a `health.ts` module) returns `ok` for `{ status: 'connected' }`, `expiring` for `expires_at` in 6 days, `expired` for yesterday, `not_connected` for `{}`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `deno test --allow-env fn/social-connect/`
Expected: FAIL.

- [ ] **Step 3: Implement the adapters and rewire `index.ts`**

Move the four `authorizeUrl` branches and four `finish` branches into the adapters without changing their requests. Keep `TIKTOK_SCOPES` behaviour by reading `p.scopes.join(',')`. Health calls: threads `GET /v1.0/me?fields=id`, youtube a token refresh, tiktok `GET /v2/user/info/?fields=open_id` (refreshing first as `tiktok-pull` does), linkedin `GET /rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED` with the three headers from `index.ts:150`. Header comment becomes v3 with a line for each change.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `deno test --allow-env fn/social-connect/`
Expected: PASS.

- [ ] **Step 5: Deploy and check live**

Deploy through the connector with files `index.ts`, `platforms.ts` (from `fn/_shared`), `adapters/*.ts`, `verify_jwt: false`.
Run: `fetch GET ...social-connect?event=uninstall` expects `{"ok":true}`; a signed-in `status` call from the Hub (Steel's browser) shows `platforms.length === 6` and `connections.linkedin.health === 'ok'`.

- [ ] **Step 6: Commit**

```bash
git add fn/social-connect
git commit -m "feat(wave277): social-connect v3, adapters, health and weekly renewal"
```

### Task 4: social-publish v6, adapters, LinkedIn media, capabilities from the registry

**Files:**
- Modify: `fn/social-publish/index.ts` (`PNAME`/`ALL` 64-65, `publishers()` 199-203, `PUBLISHERS` 578-583, `publishLinkedIn` 473-507, `capabilities` 775-800)
- Create: `fn/social-publish/adapters/types.ts`, `facebook.ts`, `instagram.ts`, `threads.ts`, `linkedin.ts`, `tiktok.ts`, `youtube.ts`
- Test: `fn/social-publish/adapters/linkedin.test.ts`, `fn/social-publish/capabilities.test.ts`

**Interfaces:**
- Produces (`adapters/types.ts`): `export type Publisher = { publish(p: Post, caps: Caps, ctx: PubCtx): Promise<Result>; modeOf(conn: Conn, ctx: PubCtx): Promise<string> }` where `Result = { id: string; url: string; pending?: boolean; via?: string }` and `Manual` is thrown as today. `PubCtx` carries `secretOrNull`, `getSecret`, `targets` (Meta), `connections()`, `capFor`, `images`, `videos`, `fetch`.
- `capabilities` response gains `platforms: Platform[]` (active only) and `caps: Record<key, Caps>`; `mode[key]` comes from each adapter's `modeOf`; the existing `can`, `token`, `granted`, `missing`, `accounts`, `comments`, `connections` keep their shape.
- `publishers()` returns the current set union the emails from `wa241_approvers()` (one RPC call).
- LinkedIn adapter: as the spec's section 3. Validation inside `publish`: `vids.length > 1 || (vids.length && imgs.length)` throws `Manual('LinkedIn takes one video, or up to twenty photos, per post')`; `imgs.length > caps.max_images` throws `Manual('LinkedIn takes up to ' + caps.max_images + ' photos')`.
- Consumes: Task 2, Task 3's `Conn`.

- [ ] **Step 1: Write the failing tests**

`linkedin.test.ts` with a recording fake fetch: (a) two images: two `initializeUpload` calls, two PUTs, one `POST /rest/posts` whose body has `content.multiImage.images.length === 2` and each `altText`; (b) one video: `POST /rest/videos?action=initializeUpload` with `fileSizeBytes` equal to the fake file length, PUTs to every `uploadInstructions[].uploadUrl`, `POST /rest/videos?action=finalizeUpload` with the ETags, then a post whose `content.media.id` is the video urn; (c) one video plus one image: throws `Manual` with the exact reason (Review Focus 2); (d) no direct token and a hook saved: posts to the hook as today.

`capabilities.test.ts`: with `studio_platforms` faked to five active rows (youtube inactive), `capabilities` returns `platforms.length === 5`, `caps.linkedin.max_images === 20`, and `mode.youtube` still present (Review Focus 1: an existing post naming an inactive platform still resolves a mode).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `deno test --allow-env fn/social-publish/`
Expected: FAIL.

- [ ] **Step 3: Implement the adapters and rewire**

Move `publishFacebook`, `publishInstagram`, `publishThreads`, `publishYouTube`, `publishTikTok` bodies into their adapter files unchanged; `PUBLISHERS` becomes `byKey` over the adapters. `ALL` becomes the registry keys (active and inactive) so old posts still match. Header becomes v6.

LinkedIn video upload: `initializeUpload` body `{ initializeUploadRequest: { owner, fileSizeBytes, uploadCaptions: false, uploadThumbnail: false } }`; upload each `uploadInstructions[i]` with a PUT of bytes `firstByte..lastByte` and collect the `etag` header; `finalizeUpload` body `{ finalizeUploadRequest: { video, uploadToken: '', uploadedPartIds: etags } }`; then poll `GET /rest/videos/{urn}` until `status === 'AVAILABLE'` at most 12 times, 5 seconds apart, else return `{ id: urn, url, pending: true }`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `deno test --allow-env fn/social-publish/`
Expected: PASS.

- [ ] **Step 5: Deploy and check live**

Deploy with `index.ts`, `platforms.ts`, `adapters/*.ts` and the current `meta.json` verify_jwt value. From the Hub, `capabilities` returns `platforms` and `caps`.

- [ ] **Step 6: Commit**

```bash
git add fn/social-publish
git commit -m "feat(wave277): social-publish v6, adapters, LinkedIn photos and video, caps from the registry"
```

### Task 5: notify learns connection_expiring

**Files:**
- Modify: `fn/notify/index.ts` (the relay kinds registry; find the `meet_avail_ask` entry from v18 and add beside it)
- Test: `fn/notify/connection_expiring.test.ts` if the registry is a plain object; otherwise a deploy-time `sample` call

**Interfaces:**
- Produces: relay event `connection_expiring` with `{ to: string[], title, text, url: '/#studio/connections', tag }`, Hub notification plus Slack DM through each person's switch, default on, registry example text "LinkedIn's connection expires in 6 days. Reconnect it on the Connections page."
- Consumes: Task 3's call.

- [ ] **Step 1: Add the kind, following the v15 registry shape (kind, words, example, default switches)**
- [ ] **Step 2: Deploy notify and call `sample {kind:'connection_expiring'}` as Steel from the Hub's notification centre; expected: the sample arrives in the Hub**
- [ ] **Step 3: Commit** `git commit -m "feat(wave277): notify kind connection_expiring"`

### Task 6: The Connections page, wave277 part

**Files:**
- Create: `build/parts277/assemble.py`, `a_head.js`, `b_css.js`, `c_connections.js`, `d_modal.js`, `z_wire.js`
- Modify: `build/parts225/z_wire.js` (where `paint` renders the connections section: call `window.w277 && window.w277.connectHtml ? window.w277.connectHtml() : connectHtml()`), `build/parts225/i_connect.js:93` (`connAct`: first line `if (window.w277 && window.w277.connAct) return window.w277.connAct(what);`), `build/parts225/a_head.js:139` (`loadConn` keeps `S.conn`; also set `S.platforms = r.platforms || []`), `build/src/MANIFEST.txt`
- Test: `test/w277drive.js`, `test/fx_w277.json`

**Interfaces:**
- Produces: `window.w277 = { connectHtml(): string, connAct(what: string): Promise<void>, state(): S277, platforms(): Platform[] }`. DOM: `#w277conn` root; rows `[data-w277row="<key>"]` with `aria-expanded`; status pill `[data-w277pill="<key>"]`; attention strip `#w277attn`; disclosure `[data-w277disc="<key>"]`; actions `[data-w277act="connect|reconnect|disconnect|save_keys|copy_redirect|meta_check|meta_save|remind_preview|open_console|make_hook|make_sample|make_test|test_short|reload"]` with `data-w277k="<key>"`; keys inputs `#w277id-<key>`, `#w277sec-<key>`; Meta token `#w277metatok`; modal `#w277modal` with `[data-w277ok]` and `[data-w277cancel]`.
- `connAct` calls `social-connect` with the same bodies wave225 sends today (`save_app`, `start`, `disconnect`, `meta_token`, `make_hook`, `make_sample`, `make_test`) plus `health`; `test_short` and `remind_preview` keep calling wave225's code through `window.w225` (expose `W()` and `posts()` if needed by adding them to the `window.w225` object at `z_wire.js:219`).
- Consumes: `window.w225.state()` for `S.conn`, `S.platforms`, `S.pub`, `S.keys`; `window.w225.paint`, `window.w225.load`; wave225's `fn` pattern (copy it: `db.functions.invoke` with the session token, honouring `window.__WA_INVOKE` for tests as `a_head.js` does).

- [ ] **Step 1: Write the failing drive**

`test/w277drive.js`, modelled on `test/w241drive.js`: fixture adds `studio_platforms` rows (six, youtube inactive), `hub_settings content_studio`, and `__WA_INVOKE` answers `social-connect status` with `{ ok, platforms: <five active>, connections: { linkedin: { status: 'connected', mode: 'direct', name: 'Welfare Avenue (LinkedIn)', connected_by: 'steel.macdonald@welfareavenue.com', connected_at: '2026-09-20T12:00:00Z', expires_at: '2026-09-30T12:00:00Z', scopes_granted: ['w_organization_social'], health: 'expiring' }, tiktok: { status: 'connected', mode: 'drafts', handle: 'welfareavenue', health: 'ok' }, threads: {}, youtube: {}, meta: { token: true, granted: ['pages_manage_posts'], missing: [] } }, redirect_uri: 'https://x/social-connect', can_change: true, can_meta: true }` and `social-publish capabilities` as w241's `CAP`.

Assertions (admin, 1366): `#w277conn` exists; rows count 5 in registry order; `#w277attn` text contains `LinkedIn` and `Expires in 5 days` and a `Reconnect` button; pill for linkedin reads `Expires in 5 days`, tiktok `To TikTok drafts`, threads `Not connected`; linkedin row chips contain `Photos 20`, `Video`, `Comments`; the linkedin disclosure opens on click, shows `Asked for 6, granted 1` and a `Reconnect` button; pressing `Save keys` with both fields filled records a `social-connect` call `{ action: 'save_app', platform: 'threads', id, secret }` and both inputs are empty after; pressing Disconnect opens `#w277modal` (no `window.confirm` called: set `window.confirm = () => { throw new Error('confirm used'); }` in INIT) and `[data-w277ok]` records `{ action: 'disconnect', platform: 'tiktok' }`; the Make card is absent and `w277mkhook` is inside the linkedin disclosure under an `Advanced` summary. As `member` (plain): rows render, no `#w277id-threads`, no `Connect` button, pill texts unchanged (Review Focus 4). At width 480: the linkedin row's action button is full width (`offsetWidth` within 24px of the row). A record `{ status: 'connected' }` with no health (fixture threads) renders `Connected` (Review Focus 3). The seg contains no `—` or `–` and no literal em dash.

- [ ] **Step 2: Run the drive to verify it fails**

Run: `CAND=build/candidate.html node test/w277drive.js`
Expected: FAIL on `#w277conn`.

- [ ] **Step 3: Write the parts**

`b_css.js`: scoped to `#w277conn`; rows 48px min-height, hairline `rgba(16,63,57,.11)` between rows, card radius 18 like wave225; press feedback on `.w277btn` and `.w277row` `transform: scale(.97)` 160ms `cubic-bezier(.23,1,.32,1)`; pill crossfade `opacity 150ms ease`; disclosure `grid-template-rows 0fr -> 1fr` with `transition: grid-template-rows 180ms cubic-bezier(.23,1,.32,1), opacity 180ms` and 120ms on close; `@media (hover: hover) and (pointer: fine)` for hover; `@media (prefers-reduced-motion: reduce)` drops the grid transition; breakpoints 620 and 480 as the spec.

`c_connections.js`: `connectHtml()` builds masthead copy, attention strip, the accounts card (Meta as one row for instagram and facebook, then threads, linkedin, tiktok, youtube by `sort`, active only), disclosures, and the test row. Pill text: `Connected`, `Expires in N days`, `Expired`, `Not connected`, `Needs attention`, or the platform's `modes[mode]` label when mode is `drafts` or `make`.

`d_modal.js`: `ask(text, okLabel): Promise<boolean>` using the Hub's `openModal`/`closeModal` from `000_head_base.seg:1240-1245` when present, else its own `#w277modal`; `prompt` for the Make hook becomes an input inside the disclosure.

`z_wire.js`: delegated click and keydown (Enter, Space) on `#w277conn`; one open disclosure at a time; `window.w277`.

- [ ] **Step 4: Assemble, add to MANIFEST, build, run the drive**

Run: `python build/parts277/assemble.py && python build/parts225/assemble.py && node build/assemble_all.js && CAND=build/candidate.html node test/w277drive.js && CAND=build/candidate.html node test/w241drive.js && node test/tour1.js all`
Expected: all PASS; w241 unchanged.

- [ ] **Step 5: Commit**

```bash
git add build/parts277 build/parts225 build/src/MANIFEST.txt build/src/277_wave277.seg build/src/225_wave225.seg test/w277drive.js test/fx_w277.json
git commit -m "feat(wave277): the Connections page, one list of accounts with health"
```

### Task 7: The composer reads the registry

**Files:**
- Create: `build/parts277/patch121.py` (applies string replacements to `build/src/121_wave121.seg`, failing loudly if an anchor is missing, in the style of `build/parts225/patch121f.py`)
- Modify (through the patch): `build/src/121_wave121.seg:35-39` (PL, PORDER), `:40` (MODE_L), `:702-750` (validation)
- Test: extend `test/w277drive.js`

**Interfaces:**
- Produces: `PL` and `PORDER` become getters fed from `C.cap.platforms` when present (fallback to today's literals so the composer paints before capabilities load); `MODE_L` reads `platforms[k].modes` with the literal fallback; a `capsOf(k)` helper returning `C.cap.caps[k]` or `{}`.
- Validation: the linkedin branch loses the two `md === 'make'` warnings and gains `if (im.length > capsOf(k).max_images) err(l, 'LinkedIn takes up to ' + capsOf(k).max_images + ' photos.')` and `if (vi.length > 1 || (vi.length && im.length)) err(l, 'LinkedIn takes one video, or photos, not both.')`; threads `20` and instagram `10` read `max_images`; tiktok `600` and youtube `180` read `max_video_s`. Every other string stays as it is.

- [ ] **Step 1: Add drive assertions**: open the composer (`window.w121.compose({ platforms: ['linkedin'], media: [img, img] })` with two image media), read the validation panel: no warning containing `first photo only`; with three videos the panel contains `one video`; with `platforms: ['instagram']` and eleven images the panel contains `up to 10 photos`.
- [ ] **Step 2: Run the drive, expect the new assertions to FAIL**
- [ ] **Step 3: Write `patch121.py` and run it, then rebuild**: `python build/parts277/patch121.py && node build/assemble_all.js`
- [ ] **Step 4: Run** `CAND=build/candidate.html node test/w277drive.js && CAND=build/candidate.html node test/w241drive.js && CAND=build/candidate.html node test/w225drive.js`; expected PASS.
- [ ] **Step 5: Commit** `git add build/parts277/patch121.py build/src/121_wave121.seg test/w277drive.js && git commit -m "feat(wave277): the composer reads platform limits from the registry"`

### Task 8: Approvers picked from the team

**Files:**
- Modify: `build/parts225/e_approvals.js:24` (the `apBox`), `:38-43` (`saveApprovers`), `build/parts225/a_head.js:121-126` (load active marketing `team_members` into `S.marketing` when `S.pub`)
- Test: extend `test/w277drive.js`

**Interfaces:**
- Produces: `apBox` renders one `label` per active marketing team member (`team_members.active && department = 'marketing'`), a checkbox `[data-w277ap="<email>"]` checked when the email is in `S.settings.approvers`, the member's name and nickname, and a `Save approvers` button `[data-w277apsave]`; `saveApprovers()` reads the checked emails and calls `studio_settings_save` exactly as today. When no team member is listed, the old text input stays as the fallback.
- Consumes: nothing new.

- [ ] **Step 1: Add drive assertions**: fixture `team_members` with Ian (email `ian.odhiambo@welfareavenue.com`, nicknames `[]`), KK (`kahkashan.ansary@welfareavenue.com`, nicknames `['KK']`), and a finance member; on `#studio/approvals` as admin the box lists two checkboxes, both checked, no finance name; unticking KK and pressing Save records `rpc studio_settings_save` with `approvers: ['ian.odhiambo@welfareavenue.com']`.
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run w277 and w241 drives; expected PASS**
- [ ] **Step 5: Commit** `git commit -m "feat(wave277): approvers chosen from the marketing team"`

### Task 9: Copy, the Academy lesson and the release

**Files:**
- Modify: `build/data/wa277_connections.sql` (append the trainings update), `build/parts225/a_head.js:1-10` (header line), `build/data/wa225_studio.sql:1-5` (header line), `docs/02-11-26 - wave277 connections and publishing.md` (create, in the style of `docs/02-11-26 - wave272 the new Home.md`: what changed, where, how to undo), `docs/HUB_RELEASE_CHECKLIST.md` if it lists waves
- Test: the full drive set and the live checks

- [ ] **Step 1: Update the Academy lesson**: `update public.trainings set body = replace(body::text, 'the named approvers (Ian and KK)', 'the approvers set on the Approvals page')::jsonb where key = 'lesson:studio';` and the same for `'how it goes to Ian and KK for approval'` to `'how it goes to the approvers'`. Apply through the connector; verify with a select that neither phrase remains.
- [ ] **Step 2: Write the wave doc** with the undo: drop `studio_platforms` FKs back to CHECKs, remove `277_wave277` from MANIFEST, redeploy social-connect v2.1 (commit 70ec7e7) and social-publish v5.
- [ ] **Step 3: Full test run**: `python build/parts277/assemble.py && python build/parts225/assemble.py && node build/assemble_all.js` then `w277drive`, `w241drive`, `w243drive`, `w225drive`, `tour1 all`; expected all PASS.
- [ ] **Step 4: Release the Hub**: `python build/deploy_stage.py`, then the DO block from `python build/deploy_gate.py` through `execute_sql`, then `select public.wa_tmp_call_edge_long('host-sync', '{}'::jsonb);`; confirm `hub.welfareavenue.com/#studio/connections` shows the new page signed in as Steel (built-in browser) and the md5 matches.
- [ ] **Step 5: Live checks**: Steel reconnects LinkedIn once (the new scopes), then publishes a two-photo post from the Hub to the Page; `select value->'linkedin' from hub_settings where key='studio_connections'` shows `scopes_granted` with six entries and `health = 'ok'`.
- [ ] **Step 6: Commit** `git commit -m "docs(wave277): release notes, academy copy"`
