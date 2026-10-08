# 07/10/26 - wave219: Hub notifications on computers and phones

Live md5 `46e503b26aa50047dd9cc87ec0a34d54` (6,798,304 bytes), deployed through the gated pipeline on top of `bd732998` (wave218). Functions: hub-push v1 (new, verify_jwt off), notify v12 (platform version 22), host-sync v12 (platform version 19). Migrations: `wa219_push_a_table`, `wa219_push_b_rpcs`, `wa219_push_d_calls` (build/data/wa219_push.sql). Site files: `sw.js`, `manifest.webmanifest`, `icons/` (build/site), `_headers`.

## What Steel asked

Steel (07/10/26): "I'm wondering if when I add the Hub website as an app on my Android phone, or if I could do that on Apple, um, and even in the browser, if it can send in-app notifications on updates, I would like to do that if it's possible, especially browser use for those that are using the computer, which is most right now." Asked, he chose:

- **What:** mentions and assigned work, and announcements.
- **Hub or Slack:** each person chooses (Hub and Slack by default).
- **The ask:** one gentle prompt on Home per device, plus a switch in Settings any time; on iPhone, Add to Home Screen first.

Then (same evening) he asked for the Admin centre to manage every automatic message and where it goes, Slack and Hub notifications alike, with admins setting it and people opting out of their own: the next wave, after this one shipped.

## What changed for people

- **The Hub is an app.** Chrome and Edge offer Install (and Settings, Notifications has an Install button where the browser allows it); Android adds it from the browser menu; iPhone and iPad from Safari's Share, Add to Home Screen. Its own window, the WEL/FAR/E icon, "WA Hub" under it.
- **Home, once per device:** "Get Hub notifications on this computer?" (or this phone, this iPad) with Turn on and Not now. Turn on asks the browser's permission from the tap. Not now (or a blocked answer) hides it for good on that device. On an iPhone in Safari the card says to add the Hub to the Home Screen first and turn it on from the app.
- **What pops up:** an @mention anywhere in the Hub ("Steel mentioned you", where and a short quote; a confidential item says so without the text), a meeting mention, a task handed to you or a new task someone gives you ("New task for you", the title, the due date, who; a confidential task is "A confidential task"), a request for your team, a meeting suggestion that becomes a request, and a new announcement, poll or short form for you. A click opens it in the Hub (an open Hub window comes forward).
- **Settings, Notifications:** this device On or Off (Turn on, Send me a test, Turn off), how to unblock when the browser blocked it, the other devices with Remove, where mentions and work for you arrive (In the Hub and on Slack, In the Hub only, On Slack only), new announcements on or off, Install. Wave116j's list of kinds now covers both places.
- **In the Hub only** silences those Slack DMs only while one of the person's devices is on; with none, Slack keeps bringing them. Announcements keep their Slack post and email (wave180) whatever the choice.
- Every visit re-saves the device for the person who turned it on there; Sign out turns that device off first. Another person signing in on the same browser does not take the device over by visiting.

## Data and server

- `hub_push_subs` (one row per device: endpoint, p256dh, auth, device label, last sent, last error, failures). RLS: a person reads their own rows; nothing else from the API. Saved by `wa219_push_save` (staff, known push services only: Google, Microsoft, Mozilla, Apple); removed through hub-push `drop` (the caller's own row).
- `wa219_channel_set` writes `wa_notify_prefs.prefs.channel` (both, hub, slack). The announcement switch is `announcement` in `wa_notify_prefs.disabled` (saved by wave116j's list).
- `wa219_push_call` calls hub-push only from a trigger (pg_trigger_depth), only when `app_config.push_on` is on and some device exists. It sits next to notify in `wa_notify_call` (request_filed, task_reassigned, suggestion_accepted, mentioned) and `trg_hub_mention_dm` (comment_mention); new triggers `trg_wa219_task_assigned` (dept_tasks insert by a signed-in person) and `trg_wa219_announce_push` (hub_announcements insert).
- hub-push: see docs/EDGE_FUNCTIONS.md. The VAPID key pair was made once by `setup`: the private key is in the vault (`PUSH_VAPID_PRIVATE`), the public key in `app_config.push_vapid_public`. Never replace it.
- notify v12: Hub only plus a device on means no Slack DM for those five events ("skipped: Hub notifications only").
- host-sync v12: also deploys the manifest, the service worker and the icons (PNG as base64 in `site_files`, parts start at 1 like the others).
- To stop it: `app_config.push_on` = off (the Home card and Settings stay; nothing is sent).

## The database step

The Supabase connector's approval for statements it reads as destructive (revoke, delete, drop) never reached Steel in this chat: the migration came back cancelled four times and timed out once, though he said yes. The parts without those statements went through (a, b, d). So: no revokes (the table's RLS already keeps everyone to their own rows; `wa219_push_call` does nothing unless a trigger calls it), and no `wa219_push_drop` (Turn off and Remove go through hub-push `drop`). The vault's `SUPABASE_ACCESS_TOKEN` (used by fn-deploy) answers 401: the functions were deployed through the connector.

## Files

- `build/src/219_wave219.seg` (MANIFEST after 218_wave218); `build/site/sw.js`, `build/site/manifest.webmanifest`, `build/site/icons/` (and `render_icons.js`, which draws them from wave117's secondary mark), `build/site/_headers` (sw.js no-cache, the manifest's type).
- `fn/hub-push/index.ts`, `meta.json`; `fn/notify/index.ts`, `meta.json` (22); `fn/host-sync/index.ts`, `meta.json` (19).
- `build/data/wa219_push.sql`.
- `test/w219drive.js` (82 checks), `test/w219crypto.js` (18 checks).
- `docs/EDGE_FUNCTIONS.md`, `docs/HUB_RELEASE_CHECKLIST.md`.

## Verification

- `test/w219drive.js` 82 of 82 on the candidate: the head (manifest, iOS icon, metas), the worker at /sw.js, the card once per device and its words, Turn on (one ask from the tap, the subscription with the Hub's key, the device saved with its label, the card gone), Not now, a blocked answer, Settings (On, the test, Hub only, announcements through wave116j's list, Turn off, the other devices and Remove, Install), the visit that re-saves and resubscribes, a new key replacing an old subscription, another person on the same browser, the worker's messages (a link to another site ignored), Sign out turns the device off first, iPhone in Safari, the iPhone app, Edge on Windows, phone widths, a board viewer, no key yet, no page errors.
- `test/w219crypto.js` 18 of 18: hub-push's encryption decrypts with http_ece; the VAPID JWT verifies with jose; a wrong auth secret or signature fails.
- `test/w217drive.js` 33 of 33 and `test/w192drive.js` 76 and the same 4 old failures on the candidate.
- Live: the page serves `46e503b2`; `/sw.js` (no-cache), `/manifest.webmanifest` (application/manifest+json) and the five icons serve byte for byte; the other public pages still serve. Chromium on the live Hub: the manifest parses with no errors, the only install blocker is the test browser's private mode, the service worker registers and activates, no page errors.
- hub-push live: setup made the key (run again it keeps it), status vapid ready with 0 devices, dry runs for a mention and a new task give the right words and send nothing, a call with no secret and no session gets 401. Google's push service accepts our VAPID signature (an unknown device answers 410; a bad signature 403). A real round trip needs a real browser: Steel's Send me a test is the first one.
- No notification was sent to anyone.

## For the next session

- The next wave: the Admin centre's control of every automatic message (Slack channel posts and DMs, emails, Hub notifications): admins turn each kind on or off and choose where it goes; each person can still turn off what is only for them. Build it on `wa_notify_prefs`, notify's `HUB_EVENTS`, hub-push's `wants`, checkin-post, team-inbox (announcements), hr-notify and the digests.
- build/candidate.html on GitHub is not the live build (not pushed: the 6.8 MB file is not joined through pg_net).
