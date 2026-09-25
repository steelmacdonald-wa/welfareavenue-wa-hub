# 25/09/26 - wave118c: the photo library

Steel sent 16 photos: "Okay I want to label all of these photos and host them in the Supabase storage. Can you set it up for successful use."

## What exists now

- **Files.** Every photo is three JPEGs in the public `content-images` bucket: `photos/full/<key>.jpg` (2400 px on the long side, quality 85), `photos/web/<key>.jpg` (1600 px, 80) and `photos/thumb/<key>.jpg` (640 px, 76). sRGB, progressive, no EXIF or ICC (no location, no camera serials), `Cache-Control: public, max-age=604800`. Public URLs carry `?v=<version>`; bump `version` on the row when a file is replaced. `&download=<name>.jpg` on a URL makes the browser save it.
- **Labels.** `public.wa_photos`, one row per photo: key (the file name), title, alt text (up to 400, aim for 250), caption, description, taken_on and date_note, season, place, event, scene, tags, usage and usage_note, people (by role, never by name), partners in view, branding era, notes, series (a set of takes from one moment), is_pick, orientation, width, height, focal_x and focal_y (0..1, where crops centre), colour (the average, used as the placeholder), best_for, credit, the three paths and sizes, status (ready, needs_labels, archived), source, labelled_by, ai_suggestion (the raw first labels), created and updated by and at. The view `public.wa_photos_list` (security invoker) adds `url_full`, `url_web`, `url_thumb`.
- **Access.** Read: staff and board viewers. Insert and update: staff. Delete: hub admins. Anon: nothing. Checked with simulated sessions: staff read 16 and can update, a board viewer reads 16 and cannot update, an outsider reads 0. Storage: staff can write `content-images` (existing policies).
- **Usage values.** `ready` fine for public use; `crop` crop the edge named in the note first; `consent` a community member or a child is recognizable, so internal use or public with their consent; `internal`; `check` not reviewed. Volunteers at work or posing count as ready.
- **AI first labels.** Router task `photo_label` (Sonnet 5, then Haiku 4.5, then Gemini 3.8 Flash), a forced `photo_labels` tool. The system prompt and tool schema live in `build/data/photo_label_spec.json` and are embedded in the segment. Tested live three times (about 6 to 7 seconds and $0.011 a photo); the rules for people (role and work clothing only) and usage sit in the field descriptions as well as the system prompt, because the model follows those more closely. Suggestions never replace a filled field on their own: the form shows each one as a note with Use this.
- **Edge function `photo-library`** (v1, verify_jwt off, own auth: trigger secret or a staff sign-in): `put` (upload up to 12 files under `photos/`), `check`, `remove` (secret or admin). For build sessions; the hub itself uploads with the person's own session.
- Migration: `docs/wa118c_photo_library.sql`. First batch: `docs/wa118c_photo_labels.json`.

## The first batch

16 photos: 10 ready, 3 crop first (`2024-07-summer-serving-line` left third, `2024-10-autumn-team-at-the-tent` right edge, `summer-serving-tent-and-line` left edge and low resolution), 3 consent (`2024-10-autumn-serving-handoff`, `2024-10-autumn-choosing-a-dish`, `2024-10-autumn-serving-salad`, which also has a child in the background), 12 picks. Dates come from the cameras (Sundays, except the Nikon set dated Friday 11 October 2024 at 08:4x, noted as approximate). Four winter photos in the message were previews only (bare-trees tent with a lamp post; three volunteers at a clothing table; two masked volunteers serving; a volunteer arranging food with Banque Nationale behind): they need to be sent as files or added through the page.

## The page (`#photos`, under More)

- Masthead (More, Photo library, one line of purpose, How this page works).
- Search (titles, alt text, captions, tags, places, people, sets, year), scene and order selects, usage chips with counts (All, Ready, Crop first, Consent needed, and Internal or Not checked when any), seasons, Picks; staff also get Needs a look and Archived when there are any. A three-line legend explains the badges.
- A grid grouped by year (newest first; on the same day confirmed before new, ready before crop before consent, picks first), each card cropped on its focal point with a usage badge and a pick star; colour placeholders while thumbnails load; 120 at a time.
- The side panel (`#photos/<key>`): the photo, what it is cleared for and why, Use in the Create studio and Use in a post (staff with those pages), Copy the link, Download; alt text and caption with Copy; the description; three download sizes with their dimensions and weights; tags (click to filter); details (taken, season, place, event, scene, people, partners, branding, set with a link to the whole set, best for, size, credit, notes, source, who labelled it, the file name). Left and right arrows step through the current filter; Esc closes.
- Edit the labels (staff): four groups (what it shows, can we use it, when and where, finding it) plus credit and notes; click the photo to set the focal point and see Square, Portrait 4:5, Wide 16:9 and Banner 1.91:1 crops; Suggest with AI; Cmd or Ctrl+Enter saves. Saving writes `labelled_by`, and the change (field by field) goes to the change log.
- Add photos (staff, `#photos/new`): drop or choose up to 25 JPEG, PNG, WebP (HEIC where the browser can read it). In the browser: the date and camera model from EXIF, the three sizes (canvas, high-quality smoothing, no metadata), the colour; then the upload with the person's session, the row (status needs_labels, usage check), and the AI's first labels. Keys follow the batch: `2023-12-winter-photo-8812`, or `undated-<name>`. Failed uploads clean up their files. Needs a look photos open one after another with Save and next.
- Archive hides a photo (Restore brings it back); an admin can delete an archived photo for good (row, then the three files).
- Board viewers get the page read only (the menu adds More for them).

## Hand-offs

- **Create studio**: under the photo field, "Or pick one from the photo library" opens a picker (ready photos by default, a toggle shows the rest with a confirmation). The pick sets the graphic's photo (`WA_CD_IMG`, the web size), switches the type to Social graphic and shows the photo with Remove. Use in the Create studio from the side panel does the same after opening the studio.
- **Content calendar** (wave121): the composer's drop zone gets "Or pick from the photo library"; the pick is fetched and added through the composer's own file input, so it gets the same JPEG conversion, ratio checks and crop buttons as an upload. Use in a post opens a new post with the title and a note carrying the alt text (and the usage note when it is not ready), then attaches the photo.
- **Search everything** lists up to four matching photos (with a thumbnail) under the hub's own results.
- **Team pages**: Marketing and Fundraising list the Photo library in their tools.
- `window.__wa118c.pick({title, why, readyOnly, onPick})` for any later wave.

Toasts now sit above side panels (`#toast` z-index 140), and the side panel sits above the check-in note (96 over 95).

## Build and test

- Source: `build/w118c/*.js`, assembled by `build/w118c/assemble.py` into `src/118c_wave118c.seg` (embeds the AI spec, fails on any non-ASCII character). Manifest: after `118b_wave118b`, before `110_wave110`.
- Parity: every node the wave adds carries `data-w118c`; `window.__wa118c.cleanNode` removes them (and re-hides a menu group that only showed because of the new tab). `test/harness.js` uses it when `W118C_STRIP=1`. Baselines regenerated from live `c12171ae`; `W118C_STRIP=1 ./compare.sh candidate.html` is ALL GREEN on 33 pages x 3 identities, error counts equal. `w116drive.js` clean for all three.
- `test/w118cdrive.js`: 69 checks as Steel (menu, chips and counts, filters, search keeps focus, sort, the panel, downloads, copy, arrows, tags, edit with focal point and AI notes, the upload of a dated JPEG and an undated PNG with a text file refused, the review queue, archive and restore, the Create studio picker and hand-off, the composer hand-off and picker, team tools, search everything, the guide), 24 as a board viewer, 62 as a member without the Create studio. `test/w118cphone.js`: phone screenshots, no horizontal scroll.

## Deploy record

On top of live `c12171ae` (the other agent's waves 116w to 121 and the Adoption admin section). Deployed 25/09/26 through the gated pipeline (`wa_stage_qb`, guard on the live md5, `host-sync`): live md5 `872daeb982db1439c1a2e52f6eb0589c` (2,713,613 bytes). Stage tables `wa_stage_qa` and `wa_stage_qb` dropped.
