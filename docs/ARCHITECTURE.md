# Welfare Avenue Hub: how the front end is put together

Checked against the code at wave134 (the 26/09/26 audit). The audit report (`docs/26-09-26 - wave134 the audit.md`) lists what was found and what is still to decide. The companion guides are `docs/DATA_MODEL.md` (the database) and `docs/EDGE_FUNCTIONS.md` (the server side).

## 1. The shape of the app

The Hub is one HTML page with no framework and no bundler. It talks to Supabase directly (tables, RPCs, storage) through the supabase-js client, and to Supabase edge functions (the `fn/` folder) through `db.functions.invoke(name, { body })`. Row level security in the database is the real guard; the menu only hides what a person should not use.

The page is assembled from 157 segments in `build/src/*.seg`. Each segment after the base is a "wave": one release that adds or changes features. Release notes for each wave are in `docs/`.

## 2. Build and deploy

1. `build/build.sh [out]` concatenates `build/src/<name>.seg` for every line of `build/src/MANIFEST.txt`, in that order, into `candidate.html`.
2. The source is what ships. The brand palette (wave114) and the team labels (wave116) used to be rewritten into the assembled page; since the audit they are baked into the sources (`bake_remaps.py`), and `check_remaps.py` fails the build if a legacy colour or an old team label comes back. Lines in MANIFEST that start with `#` are comments.
3. Some segments are generated. Do not edit them by hand; edit the parts and re-run the assembler:
   - `build/partsNNN/*.js` plus `assemble.py` produce `src/NNN_waveNNN.seg` for waves 122 to 134 (non-ASCII is escaped).
   - `build/w118c/*.js` plus `assemble.py` produce `118c_wave118c.seg` (it embeds `data/photo_label_spec.json`).
   - `117_wave117.seg` and `118_wave118.seg` were generated once (the generators are in `build/archive/`); both have been edited since, so the segments are the source.
4. Deploy: `deploy_stage.py` splits the build into 10 parts and posts them to a stage table; `deploy_gate.py` prints a guarded SQL block that checks md5s and markers and swaps the parts into `public.site_files`; the `host-sync` edge function publishes it. `HUB_RELEASE_CHECKLIST.md` lists the rest.

## 3. Anatomy of the page

- **Head** (`000_head_base.seg`): a small script with `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `FUNCTIONS_BASE`; supabase-js from jsDelivr; the base CSS (colour tokens on `:root`); the boot veil CSS.
- **Body markup** (`000_head_base.seg`): the boot veil `#wa110veil` (its first-paint script rotates the fun facts and, from wave149, the week's lines and shout-outs that `149_wave149` caches in `localStorage` `wa149reel` after sign-in; shown only while the browser holds a Hub sign-in. The news banner moved to the top of Home in wave151 (`151_wave151`, read live)); the sign-in gate `#gate`; `header.wa-header` (the old brand row, hidden since wave114); `div.wa-toolbar` (search, status and account buttons, restyled by later waves); `nav.wa-nav > #tabBar` with ten buttons; `<main>` with twelve `section.panel` elements (`overview`, `dashboard`, six department panels, `needsme`, `activity`, `transcripts`); `#toast`; `#modalBack` and `#modalBox`.
- **Main script**: one `<script>` that starts in `000_head_base` and ends in `999_tail`. Every other segment is a slice of it.

Later waves create 27 more panels (`WA_NAV.register` creates a `section.panel` for a new id; `#personpage` appears on first use), inject their own `<style id="waNNcss">` (140 style elements at runtime), and add buttons to `#tabBar`.

## 4. Boot sequence

1. The browser evaluates the whole main script top to bottom. Each segment runs its setup code at once: it injects CSS, installs wrappers around shared functions, adds document-level listeners and defines `window.*` APIs.
2. The last statement of `000_head_base` is an async IIFE (`boot`). It creates the client (`initCloud`, which sets `db`), then awaits the session. Because of that `await`, everything else in the script has finished loading before the next step runs.
3. `boot` reads the session, calls the `get_my_role` RPC (`staff` or `board`; anything else shows the gate), sets `USER` and `MODE`, hides the gate and calls `startApp()`.
4. `startApp` is the base function wrapped by 103 later layers. The base part renders the identity and the board chrome, seeds empty tables, loads the shared caches (`loadAll`, `loadLastSeen`), renders What's new, the decisions, the department sections and the dashboard, then for staff the transcripts, activity, needs-me and search, and finally calls `applyHash()` and starts listening to `hashchange`. Each wave's wrapper awaits the inner `startApp` first and then does its own work, so the steps run in MANIFEST order.
5. `110_wave110` is the last wrapper. When the whole chain resolves it adds `html.wa-ready`, which fades out the veil (a 9 s failsafe shows the page anyway).

## 5. Layering rules (how waves are written)

- **Order is behaviour.** A wave can only see what earlier segments defined. MANIFEST order is not numeric: `001_wave116a` (the teams registry) runs right after the base, `116q` runs before `116p`, `119` to `126` run before `117`, `118`, `118b`, `118c`, then `127` to `133`, and `110_wave110` must stay last. New waves go after `134_wave134` and before `110_wave110`.
- **Waves 2 to 40** declare top-level functions and variables. A second top-level `function` with the same name replaces the first everywhere (hoisting).
- **From wave 41** each wave is an IIFE, usually guarded by a run-once flag: `if (window.__waNN) return; window.__waNN = true;` (122 such flags). Names declared inside are private. If another wave needs one, publish it on `window` (the audit fixed several features that failed silently because they read a private name: `WA46`, `wa46IsHr`, `W116.events`).
- **Extending behaviour** is done by wrapping a global:
  ```js
  if (typeof showPanel === 'function') {
    var __spNN = showPanel;
    showPanel = function (id) { __spNN.apply(this, arguments); /* then this wave's work */ };
  }
  ```
  The most wrapped functions are `startApp` (103), `showPanel` (44), `applyHash` (21), `renderSection` (16), `wa40Render` (9), `renderAllSections` (8), `renderGoalsPage` (8) and `renderMyPage` (7). The last wave to wrap runs outermost.
- **Patching another wave's output** is done after the fact: a MutationObserver or a `setTimeout` re-finds the DOM and changes it (81 observers exist when the page is ready). Prefer calling a published API where one exists.
- **Script-level globals.** `db`, `USER`, `MODE`, `SESSION`, `DEPT_ORDER`, `DEPT_LABEL`, `DEPT_COLOR`, `SECTIONS` and the `DB_*` caches are top-level `let` or `const`. They are visible to every segment by name but they are not properties of `window`: write `db`, never `window.db`.
- **CSS.** Each wave injects its own style element. Waves 114, 117 and 118 write their CSS into `#wa97css`, which a wave97 MutationObserver keeps last in `<head>` so it wins. Brand colours are the five in `brand_remap.py` (cream `#FFFAF2`, green `#103F39`, ground `#1F201E`, purple `#6F64AB`, gold `#DCA527`).

## 6. Registries and shared hooks

| Name | Defined in | What it is |
|---|---|---|
| `WA_TEAMS` | `001_wave116a` | Team order, labels, short labels, each team's menu pages, the Fundraising sub-boards. It also patches `DEPT_ORDER`, `DEPT_LABEL`, `DEPT_COLOR`, `SECTIONS`. |
| `WA_NAV` | `042_wave42`, `134_wave134` | `pages` (route registry), `register({id, label, group, dot, gate, onShow, panel, noRoute})`, `rebuild()`. `register` enrols the id in the role defaults, creates the panel and the menu button, and routes `#id/...` to `showPanel(id)` plus `onShow(hash)`; a page registered twice is kept once. `WA_NAV.layout` (in `parts134/a_head.js`) is the one list of where every page sits in the menu, and `WA_NAV.applyLayout()` moves the buttons there. |
| Role gate | `040_wave40` | `WA40_TABS`, `WA40_DEFAULTS` (admin, leader, member, viewer), `WA40_MINE` (the person's `hub_roles` row), `wa40Allowed()` (tabs this person may open), `wa40Enforce()` (hides menu buttons). A `showPanel` wrapper sends other pages back to the overview, except `needsme`, `personpage`, `projectpage`, `volunteering` and `importantinfo`. |
| Access profiles | `127_wave127`, `131_wave131` | `hub_access_profiles.pages` decides `all`, `lead` or `none` per page; 127 wraps `wa40Allowed` and `wa40Enforce` so the menu follows the profile. Page names, groups and database locks for the Admin screens are in `parts127/a_head.js` and `parts131/a_head.js`; `TAB_LABEL` in `110_wave110` names pages for "Request more access". |
| Database locks | SQL | RLS, `wa_page_ok('<page>')`, `can_see_board()`, `wa_org_editor()`. The menu is not a security boundary. |
| Tours | `122_wave122` (`parts122/f_tours.js`) | `window.w122` exposes `tours`, `startTour`, `endTour`, `openTraining` and more. Later waves add `w122.tours.<key> = {tab, icon, hash, steps}`; a step is `{s: selector, t: title, p: text, opt}`, `{h: heading regex, up: container selector, ...}` or `{c: 1, t, p}` for a text-only card. Each tour also needs a `trainings` row `tour:<key>`. |
| Page masthead | `118_wave118` `MAST` | Breadcrumb section, title and one-line purpose per page. The breadcrumb is the page's menu group from `WA_NAV.layout` (Home for the top three). |
| Help popups | `043_wave43` and later | Buttons `[data-w43help="<page>"]`; the modal text is rewritten by 060, 061, 065 and 085 in turn (the last one wins). |
| Modal | `000_head_base` | `openModal(html)`, `closeModal()`. |
| Sheets and drawers | per wave | `#w122sheet` to `#w133sheet`, the task drawer `#w116dr` (`window.w116Board`). Each wave has its own `openSheet`/`closeSheet`. |
| Toasts | `000_head_base` | `toast(msg)`; later waves wrap it as `toastS`; 132 and 133 add an undo snackbar. |
| Audit trail | `000_head_base` | `logChange(type, id, field, old, new)` writes `change_log` (many waves insert directly). |
| Escaping | `000_head_base` | `esc(s)` and `escapeHtml(s)` escape `& < > " '`, so they are safe in text and in attribute values. |
| Public APIs | many | `window.W116`, `w116Route()`, `w116Refresh()`, `w116Avatar()` (team pages); `window.w1NN` objects and `wNNNDebug()` for the drive tests. |

## 7. Data: loading and caching

- The client is `db` (a supabase-js v2 client). Queries are written inline: `await db.from('table').select(...)`, `db.rpc('name', args)`, `db.functions.invoke('name', { body })`.
- `loadAll()` in `000_head_base` fills the shared caches once per boot: `DB_DECISIONS`, `DB_META`, `DB_UPDATES`, `DB_TASKS`, `DB_MEMBERS` (active only, plus `MEMBER_BY_ID`), `DB_ASSIGN`, `DB_SENTIMENT`, `DB_HOURS`, `DB_CHANGES` (staff only; `DB_CLICKUP` stays empty since the audit, nothing reads it). Write paths call `loadAll()` again and re-render.
- Almost every later wave keeps its own cache in a private object (`W116`, `WA37`, `W115`, `B` in the bank, `O` in the org chart) and loads its own tables. The same table is often loaded several times at boot (`team_members` 18 times); reuse `DB_MEMBERS` and the other caches where they fit.
- Edge functions: 39 are invoked from the page by name (for example `ask`, `llm`, `hub-invite`, `notify`, `process-transcript`, `goal-sync`, `board-pack`, `meet-attendance`, `forms-flow`, `security-check`, `search-console`, `hub-reel`). All 62 live functions have their source in `fn/` (see `docs/EDGE_FUNCTIONS.md`). Every model call goes through the `llm` router.
- Errors: most code wraps work in `try { } catch (e) { /* fine */ }`. When debugging, remove the empty catch locally first.

## 8. Routing

- Clicking a menu button sets `location.hash` (`setupTabs` in the base: `overview` becomes `#decisions`, a team becomes `#dept/<team>`, other ids `#<id>`). `116_wave116` intercepts team buttons in the capture phase and goes to `#team/<team>`.
- `hashchange` runs `applyHash()`. The base handles `dept/`, `decisions`, `overview`, `needs-me`, `task/`, `decision/`, `tx/`, `dashboard`, `transcripts`, `activity`. 21 wrappers add their own routes; the one from `042` dispatches every `WA_NAV.pages` id. 25 more `hashchange` listeners react to their own hashes.
- `showPanel(id)` removes `.active` from every panel and tab and adds it to the target. Its wrappers render the page, apply the role gate and redirect aliases: team ids go to `#team/<id>` (116i), `dashboard` opens the Executive dashboard (111).
- Parameterised routes: `#team/<team>/<page>`, `#project/<id>` (panel `projectpage`), `#person/<name>` (panel `personpage`), `#orgchart/<id>`, `#hrcentre/<tab>`, `#adminpanel/<section>`, `#training/...`, `#requests/...`, `#volunteering/e/<id>`, `#bank/<team>`, `#photos/<id>`, `#ourstory/...`, `#partners/<id>`, `#documents/q/<words>`, and the public `#confirm/<token>`.

## 9. Navigation

`#tabBar` is one list of buttons that later waves regroup by moving the same elements (never recreating them, so click routing keeps working). Group containers are `span.tab-group[data-w42g="<key>"]` with a header `.tab-group-h` and a body `.tab-group-p`; a team row is `div.w42d` with its flyout `div.w42sub`.

- Since wave134 one place decides the menu: `WA_NAV.layout` in `parts134/a_head.js`. Since wave163: Home, the Avenue Academy, the Executive dashboard and the Calendar at the top (`top`), the Events calendar next when the person cannot open the Fundraising team page (`afterCalendar`), then The Brain (`afterEvents`); Departments (the team rows `116` builds from `WA_TEAMS`, with each team's own pages in its row); Other Tools (Important info, The Task Bank, Agendas, the Document finder, the Transcript archive, the Photo library, Requests; it also takes any page the layout does not name) and Organization (the Org chart, Our story, the Hub inbox). The Strategy and CRM apps' pages sit in an `apps` group and the Admin sections in the `admin` group, both hidden (wave153's CSS): they are reached through their apps. Directors (the board view) get a Board group with Board overview and Committees, the Events calendar after the Calendar, and Partners in Organization (they open no apps; `html.w163dir`).
- `applyLayout()` runs at boot, after the older rebuilds in `013` and `042` (the `073` rebuild defers to it), and again whenever something moves a button (one observer on `#tabBar`, with a safety valve). The older placement code in `073`, `116d`, `116h`, `124` and `126` defers to it when `WA_NAV.layout` is set, `WA_NAV.register` (`042`) hands new buttons to it, and the observer puts back whatever `095`, `116` and `132` still move. The team-row placements (`116` adopt, `120`, `121`) and the profile row flattening (`127`) are unchanged.
- `114` turns the bar into the left sidebar with CSS only.
- **The menu shows once, whole (wave163).** Every wave that shapes the menu runs after its own data arrives, inside the `startApp` chain, so on a slow load the menu used to be rebuilt in front of the reader after the loading screen's 9 second failsafe. `163_wave163` hides the sidebar's contents (`html:not(.w163nav) nav.wa-nav > *`) until the chain has run: its `startApp` wrapper applies the layout one final time, waits until `#tabBar` has been still for 140 ms (2.5 s at most), then sets `html.w163nav` and fires `wa163nav`; `110`'s reveal waits for it (1.5 s at most), so the page appears whole. A failsafe shows the menu after 20 s. The observers `163` puts on `#tabBar` only watch (for the still moment, and `w163.state().after` counts any page that moves in or out afterwards: the tests expect 0); they move nothing. Anything that shapes the menu belongs in the `startApp` chain, never on a later timer.
- **The phone menu (wave163b).** Up to 900 px wide, `#w163bar` (Home, Calendar, Ask, My team, Menu; directors: Dashboard, Calendar, Board, Menu) replaces `114`'s `#w114bar` (kept in the page, hidden). My team is the person's roster department (`WA_ME.department`) when its team page opens for them, else the sheet at Departments. Menu opens `#w163sheet`, a full-screen sheet drawn from `#tabBar` each time it opens (so it always follows the layout and the access rules): Find a page (the Hub's pages, the teams' own pages and every app page the person can open), the apps as tiles, then the top pages, Departments (each team with its own pages as chips, theirs marked), Other Tools and Organization; inside an app it is the app's menu (`WA_APP.items`) with Back to the Hub. A choice presses the same `#tabBar` button (or `WA_APP.go`). The bar steps aside while typing (`w130typing`), while the sheet is open and while Ask the Hub is open (full screen on a phone; the old bar sat on its message box). The app bar's own Menu button is hidden on phones.
- To move a page, change `WA_NAV.layout` only. The page crumbs (`118` `MAST` and the pages' own headers), the access profile editor's `GROUPS` (`parts127`, `parts131`) and the menu step of the chrome tour use the same group names.
- **The apps (since wave153).** A dock at the foot of the sidebar (`#w153dock`, sticky) holds the 9-dot launcher (`#w153pop`: the Hub, the CRM, the HR centre, Finance, the Admin centre; only the apps whose pages this person can open, none for directors). Inside an app `body.w153app` (and `body.w153<app>`) hides `#tabBar` and shows the app's rail `#w153rail` (its pages and sections, the current one marked) and the app bar `#w153bar` at the top of `main` (the app, where you are, quick actions; since wave163 the phone's bottom bar Menu opens the app's menu). The apps are a frame around existing pages: `APPS` in `parts153/a_head.js` lists each app's pages and rail items (`{h, l, ic, page, sec}`; `sec` names a section switched inside the page, read and clicked through `SEC` in `parts153/c_frame.js` for `#finances` and `#hrcentre`). An app's pages are not in the Hub's menu (their buttons stay in `#tabBar`, hidden by CSS, because they carry the access rule and the routing), an app holds nothing but its own pages, and any address of an app's page opens that app's frame (`ownerOf(page)`); a Hub page leaves it, and Back to the Hub returns to the last Hub page (`localStorage` `wa153.last`). `WA_APP.open(id)` / `WA_APP.close()` for other waves. To add an app or a rail item, edit `APPS` only, and add the page's tab to the hide rule in `parts153/b_css.js`; access follows the menu (a hidden-by-access tab, `style.display`, is a page that person cannot open). Since wave164 an app whose one group is named after itself (Finance, the HR centre) shows no group heading (`items()` marks it `solo`), a rail item can carry a count (`n`), inside any app the page's crumb is hidden (the app bar is the crumb), and on a computer the Finance page's and the HR centre's own tab strips are hidden (the rail is their menu; phones keep them).
- **Finance is not a team page (wave164).** The team is Fundraising (Grants, Event fundraising, Donor relations). Finance has its own key, `finance` (label Finance, `DEPT_COLOR.finance` #B9851B, in `WA_TEAMS.labels` and `short` like `exec`, not in `WA_TEAMS.order`): its tasks are `dept_tasks.department = 'finance'` (the Finance app's Tasks section draws `w116Board` with that scope; `#team/finance` opens it), its requests and emails are `dept_requests` / `hub_mail` with `department = 'finance'`, shown by Finance's team inbox card on the Finance Overview (`w123.cardHtml('finance')`). `WA_TEAMS.inbox` lists the teams that receive requests and emails (the seven teams plus Finance); the Requests page (`parts123`, `INBOX`) and the Hub inbox page's Filing use it, and Finance's team inbox follows the Finance app's access (`finances`). A meeting tagged Finance maps to `finance` in `txDeptKey`, `process-transcript` and `apply_transcript_result`.
- **One-on-ones and the archive (wave165).** A meeting's visibility decides who reads it and everything it files: `speakers` is for a one-on-one, only the people speaking in it (names and every address they sign in with, `wa_people_expand`; `wa_email_aliases` holds Steel's gmail). The web app trusts row security for it (`wa62SeeTx` keeps what came back). `transcripts.archive_only` marks meetings kept for the archive and Ask the Hub only: the insert triggers skip them, the archive shows an "archive only" chip and no Reprocess. Ask the Hub's meetings come from `wa_ask_meetings` run as the asker (words weighted by rarity, title words double), marked ONE-ON-ONE, LEADERS or CONFIDENTIAL in the model's context.

## 10. How to add a page

1. **Segment.** Create a `build/partsNNN/` folder with `assemble.py` (or `src/NNN_waveNNN.seg`) as one guarded IIFE, and add it to MANIFEST after `134_wave134`, before `110_wave110`.
2. **Route, panel and menu.** In a `startApp` wrapper, call `WA_NAV.register({ id, label, dot, gate, onShow })` once. Then add the id to the right group in `WA_NAV.layout` (`parts134/a_head.js`); a page the layout does not name lands in Other Tools. Do not write placement code, and nothing that shapes the menu on a later timer (the menu shows once, when the `startApp` chain has run; wave163). The phone sheet picks the page up by itself.
3. **Render** inside `onShow(hash)` into `#<id>`; read shared caches first; publish anything other waves need on `window`.
4. **Access.** Choose the `gate` (viewer, member, leader, admin). Add the page to every profile in `hub_access_profiles.pages`, give it a label and a group in `parts127/a_head.js` and `parts131/a_head.js` (`LABEL`, `GROUPS`, `LOCK`), add it to `TAB_LABEL` in `110_wave110`, and lock sensitive data in SQL with `wa_page_ok('<id>')` and RLS.
5. **Page chrome.** Add a `MAST` entry in `118_wave118` for the breadcrumb (the menu group) and purpose line.
6. **Training.** Add `w122.tours.<id>` steps and a `trainings` row `tour:<id>`; run `node test/tour1.js <id>`.
7. **Tests and docs.** Write `test/wNNNdrive.js` (admin, a member with a custom tab list, board viewer, phone width), run the harness for the three identities, then follow `docs/HUB_RELEASE_CHECKLIST.md` and add `docs/<date> - waveNNN.md`.

## 11. Tests

All tests run offline in Playwright with the Chromium in `/opt/pw-browsers`.
- `test/stub_supabase.js` replaces supabase-js. It serves rows from `window.__WAFIX` (a fixture), filters `eq`, `in`, `is`, `neq`, orders and limits, acknowledges writes without applying them, and answers RPCs from `window.__WA_RPCS` (`get_my_role` from `window.__WA_TEST_ROLE`).
- `test/harness.js <candidate> <outdir> [role email name]` freezes the clock and `Math.random`, visits every `.panel[id]` and writes one HTML snapshot per page plus `chrome.html` and `report.json`. `test/compare.sh` diffs three identities against `baseline_*` folders (not present in the repo today).
- `test/boot.js` is the shared boot for new tests: `fresh(browser, { who: 'admin' | 'member' | 'leader' | 'board', width, hash, init, rpcs })` returns a page on the fixture with the clock fixed. It serves the brand fonts from `test/fonts` (Barlow Condensed and Space Grotesk, OFL) so screenshots match production.
- `test/wNNNdrive.js` are the wave drive tests (cases such as admin, member, board; widths). Waves 130 to 134 read `fixture_live.json` from a session scratchpad outside the repo (an anonymised fixture in the repo is still to do); the others use `test/fixture.json`.
- Helpers: `tour1.js` (walk one tour), `churn.js` (repaint loops), `sections.js` (page sections, for writing tours), `csptest.js` (content security policy), `audit_pages.js` (every page's headings, buttons and a screenshot, per identity).

## 12. Page map

Main segments are the ones that render or route the page (runtime probe plus source references). Full detail, including tables read and access per role, is in `docs/audit/fe_pages.json`.

| Route | Menu label | Menu place | Main segments |
|---|---|---|---|
| `#mypage` | Home (the news banner along the top from 151) | top level | 009, 074, 075, 089, 105, 112, 115, 116, 151 |
| `#overview` | Executive dashboard | top level | 000, 111, 116g, 116m, 128 |
| `#calendar` | Calendar | top level | 124 |
| `#team/<team>/...` | each team in Departments (Meeting attendance moved to the HR centre in 149) | Departments | 116, 116b, 116i, 116t, 122, 123, 124, 126, 132, 144 |
| `#volunteering/...` | MTL volunteering (the volunteer survey, the event audit and the sign-ups from 145) | Operations Montreal row | 020, 023 to 026, 031, 106, 119, 119b, 145 |
| `#contentcal` | Content calendar | Marketing row | 121, 118c |
| `#socialstats` | Analytics (with Google Search from 147; hover numbers on every graph and post photos from Hub storage from 149) | Marketing row | 120, 129, 147, 149 |
| `#fundevents` | Events calendar | Fundraising row | 124 |
| `#finances`, `#finances/<section>` | Finance (Overview, Tasks, Trends, Money map, Budget, Transactions; Finance's own board and team inbox since 164) | the Finance app (153; not part of Fundraising since 164) | 022, 090 to 094, 164 |
| `#hrcentre/...` | HR centre (Meeting attendance for the admins and the Executive profile from 144, with each team's meetings and the board meetings from 149; the onboarding quizzes from 145) | Human Resources row | 046, 047, 049, 052, 054 to 057, 065, 075, 103, 105, 106, 116p, 144, 145 |
| `#governance`, `#committees` | Board overview (with the board pack card from 143; board attendance moved to the HR centre in 149), Committees | Board & Governance row (directors: Board group) | 126, 143 |
| `#agendas` | Agendas | Other Tools | 006, 007, 019, 047, 053 |
| `#transcripts`, `#tx/<id>` | Transcript archive (the Loom card for admins at the top from 162) | Other Tools | 000, 002, 021, 062, 065, 066, 162 |
| `#requests/...` | Requests | Other Tools | 005, 050, 065, 123 |
| `#hubmail` | Hub inbox | Organization | 116h, 123 |
| `#orggoals`, `#goalmap` | Organizational goals, Goal alignment | the Strategy app (163) | 116f |
| `#goals` | Department goals | the Strategy app (163) | 015, 016, 029, 030, 034, 068, 079, 116f |
| `#projects`, `#project/<id>` | Projects (a project's page opens in the Strategy app too) | the Strategy app (163) | 116d, 116e; project page 027, 028, 099, 100, 101, 104, 132 |
| `#brain` | The Brain | top level, after the Calendar (163) | 087 |
| `#bank` | The Task Bank (The bank until 163) | Other Tools | 132 |
| `#orgchart` | Org chart | Organization | 011, 012, 133 |
| `#training/...` | Avenue Academy (Learning Avenues, tours, library; the hard knowledge check and the brand lesson blocks from 150 live in 122) | top level, under Home (163) | 122 (classic view: 036, 037, 044, 045, 057, 058) |
| `#crm`, `#crm/c/<id>`, `#crm/dupes`, `#crm/sources`, `#crm/gifts` | CRM (every contact, their page and timeline, the duplicates, the sources, the gifts; from 152, an app with its own rail from 153) | the CRM app | 152, 153 |
| `#activity` | Activity | Admin | 000, 085 |
| `#adminpanel/<section>` | Admin sections (the monthly security check at the top of Security and audit trail from 146; Loading screen from 149) | Admin | 040, 072, 086, 096, 113, 115, 116l, 116n, 116r, 118, 127, 131, 146, 149 |
| `#importantinfo` | Important info (no Training videos section since 163) | Other Tools | 004, 134 (passwords by request) |
| `#photos` | Photo library | Other Tools | 118c |
| `#ourstory`, `#ourstory/lessons`, `#ourstory/e/<id>`, `#ourstory/<year>` | Our story (timeline and Lessons learned) | Organization | 140 |
| `#partners`, `#partners/<id>` | Partners (partner, collaborator, sponsor from 163) | the CRM app (directors: Organization) | 140, 153 |
| `#documents`, `#documents/q/<words>` | Document finder | Other Tools | 140 |
| `#create` | Create studio (hidden tab) | team tools | 017, 018 |
| `#dashboard` | alias of the Executive dashboard numbers | hidden tab | 000, 111 |
| `#person/<name>` | none | links | 033, 036, 116c, 116k, 133 |
| `#confirm/<token>` | none (public) | links in texts | 031 |
