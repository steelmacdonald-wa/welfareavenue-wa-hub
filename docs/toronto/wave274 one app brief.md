# wave274 one app brief: one Volunteer Manager, two cities (for one builder with no other context)

Repository: `/home/user/welfareavenue-wa-hub`, branch `ccr-50e3ba2b-mbnz80`. Do not commit, push, deploy, apply SQL or
touch any database or the network. Read the whole brief first.

## 1. The goal

Steel (06/11/26): "there should only be one CRM ... we could definitely combine both Montreal and Toronto in one app but
keep procedures made differently." Earlier (05/11/26): "I don't want Montreal methodologies to mess up Toronto
methodologies and operations."

Today the launcher has two apps on the same tables: the **Volunteer Manager** (Montreal, page `volunteering`, hashes
`#volunteering...`, waves 191, 259 and others) and **Toronto Volunteers** (wave274, page `toronto`, hashes `#toronto...`,
`build/parts274/`). Make them **one app, the Volunteer Manager, with a city switch**, while each city keeps its own
screens, words, stages and automations exactly as they are. There is one CRM; nothing here touches it.

## 2. The design

- **One launcher tile**, "Volunteer Manager", blurb "Servings and events in Montreal and Toronto", the Volunteer Manager's
  green and heart icon. Toronto Volunteers is no longer a separate tile, in the launcher, Home's Your apps (wave272) or
  anywhere else that lists apps.
- **A city switch** at the top of the app's rail (and in the app bar's menu on a phone): a two-part segmented control,
  **Montreal | Toronto**, real buttons with `aria-pressed`, 44 px tall on a phone, keyboard reachable, visible focus,
  press feedback `scale(0.97)` 160 ms `cubic-bezier(0.23, 1, 0.32, 1)`, no other motion (switching cities is a page
  change, not an animation). Montreal goes to `#volunteering`, Toronto to `#toronto`.
- **Each city's own rail and pages, unchanged**: in Montreal, exactly today's groups and actions (Servings, Calendar,
  People, Messages, Setup; Text volunteers). In Toronto, exactly wave274's (Events, Volunteers; New event). The city
  shown is the one the current hash belongs to. Toronto keeps its purple accent, Montreal its green: the colour says
  which city you are in.
- **Who sees what**: a city is offered when the person may open its page (`volunteering` for Montreal, `toronto` for
  Toronto, the same checks the launcher uses today, `wa40Allowed` and the access profiles of wave127). With both, the
  switch shows. With one, no switch, and the tile opens that city. With neither, no tile (as today).
- **Where the tile opens**: the last city this person used (`localStorage`, wrapped in try/catch, a per-viewer
  convenience only); the first time, by profile: `opsto` opens Toronto, everyone else Montreal.
- **Your apps**: `TEAM_APPS.opsto` becomes `['volunteer', 'crm']` (matching the CRM rebuild's own plan for wave282),
  `opsmtl` stays `['volunteer']`. `ORDER` loses `'toronto'`.
- **Every address keeps working**: `#volunteering...` and `#toronto...` are unchanged, so links, emails, the calendar's
  Open the event (which already sends Toronto events to `#toronto/e/<id>`) and tests still land.
- The masthead names the app "Volunteer Manager"; the page titles stay each city's own (wave274's `setMast` guards its
  titles against wave197's rename: keep that working).

## 3. Where things are (read these)

- The app frame: `build/parts153/` (assembled by `python3 build/parts153/assemble.py` into `build/src/153_wave153.seg`):
  `a_head.js` (`APPS.volunteer`, `APPS.toronto`, `ORDER`, `TEAM_APPS`, how an app owns pages and draws its rail
  `groups` and `actions`), `c_frame.js` (the rail, the app bar, the launcher, the `newevent` action), `b_css.js`.
  Edits marked `/* wave274 (one app) */`.
- Toronto: `build/parts274/` (`a_head.js`, `z_wire.js`: how it registers, its masthead and New event).
- Home's Your apps: `build/parts272/` (it reads `APPS` and `TEAM_APPS`; it was repainted by wave274 after registering).
- Access labels: `build/parts127/a_head.js`, `build/parts131/a_head.js`, `src/110_wave110.seg` `TAB_LABEL`,
  `src/118_wave118.seg` `MAST`: the `toronto` page stays its own access page with its own label (People and access still
  decides it per profile); only the launcher grouping changes.
- The briefs and design bar: `docs/toronto/wave274 brief.md` section 6.
- Never edit a `.seg` by hand when it has parts; run the assembler, then `bash build/build.sh`, then check `git status`
  shows only the segments you meant to change.

## 4. Tests

Run with `export WA_CHROME=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome CAND=build/candidate.html`.

- Update the checks that list the launcher's apps (`test/w153drive.js`, and any in `test/w274drive.js`, `test/w272drive.js`)
  to the one tile, saying why in a comment.
- Add `test/w274onedrive.js`: admin (both cities, the switch, Montreal by default the first time, the last city
  remembered), plain on the `opsto` profile (Toronto by default, Your apps shows the Volunteer Manager and the CRM), a
  profile with only `volunteering` (no switch, Montreal), a profile with only `toronto` (no switch, Toronto), each at
  1366 and 390 px: the switch works by click and keyboard, each city's rail is its own, no sideways scroll (compare with
  `screen.width`), no page errors.
- Regression before and after: `w274drive` (222), `w274break` (238), `w274bdrive` (134), `w259drive` (22), `w191drive`
  (39), `w272drive` (152), `w153drive` (45 of 46 is the known baseline), `w195drive` (52).

## 5. Docs

A section "One app, two cities" in `docs/05-11-26 - wave274 the Toronto Volunteers app.md`, an update to wave274's
`docs/ARCHITECTURE.md` paragraph, and in your report the lines the plan's ledger and section 7 should say.

## 6. Hand back

The files changed; the test counts before and after; screenshots in
`/tmp/claude-0/-workspace/84a99a95-9e9a-5af9-9254-00335e8dcb61/scratchpad/shots274one/` (the launcher, Home's Your apps,
the rail with the switch in each city, the phone's app bar menu, for admin and opsto at both widths); anything the
elephant should know.
