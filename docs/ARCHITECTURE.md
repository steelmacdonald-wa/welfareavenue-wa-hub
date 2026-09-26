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
- **Body markup** (`000_head_base.seg`): the boot veil `#wa110veil`; the sign-in gate `#gate`; `header.wa-header` (the old brand row, hidden since wave114); `div.wa-toolbar` (search, status and account buttons, restyled by later waves); `nav.wa-nav > #tabBar` with ten buttons; `<main>` with twelve `section.panel` elements (`overview`, `dashboard`, six department panels, `needsme`, `activity`, `transcripts`); `#toast`; `#modalBack` and `#modalBox`.
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
- Edge functions: 38 are invoked from the page by name (for example `ask`, `llm`, `hub-invite`, `notify`, `process-transcript`, `goal-sync`, `board-pack`, `meet-attendance`, `forms-flow`, `security-check`, `search-console`). All 61 live functions have their source in `fn/` (see `docs/EDGE_FUNCTIONS.md`). Every model call goes through the `llm` router.
- Errors: most code wraps work in `try { } catch (e) { /* fine */ }`. When debugging, remove the empty catch locally first.

## 8. Routing

- Clicking a menu button sets `location.hash` (`setupTabs` in the base: `overview` becomes `#decisions`, a team becomes `#dept/<team>`, other ids `#<id>`). `116_wave116` intercepts team buttons in the capture phase and goes to `#team/<team>`.
- `hashchange` runs `applyHash()`. The base handles `dept/`, `decisions`, `overview`, `needs-me`, `task/`, `decision/`, `tx/`, `dashboard`, `transcripts`, `activity`. 21 wrappers add their own routes; the one from `042` dispatches every `WA_NAV.pages` id. 25 more `hashchange` listeners react to their own hashes.
- `showPanel(id)` removes `.active` from every panel and tab and adds it to the target. Its wrappers render the page, apply the role gate and redirect aliases: team ids go to `#team/<id>` (116i), `dashboard` opens the Executive dashboard (111).
- Parameterised routes: `#team/<team>/<page>`, `#project/<id>` (panel `projectpage`), `#person/<name>` (panel `personpage`), `#orgchart/<id>`, `#hrcentre/<tab>`, `#adminpanel/<section>`, `#training/...`, `#requests/...`, `#volunteering/e/<id>`, `#bank/<team>`, `#photos/<id>`, `#ourstory/...`, `#partners/<id>`, `#documents/q/<words>`, and the public `#confirm/<token>`.

## 9. Navigation

`#tabBar` is one list of buttons that later waves regroup by moving the same elements (never recreating them, so click routing keeps working). Group containers are `span.tab-group[data-w42g="<key>"]` with a header `.tab-group-h` and a body `.tab-group-p`; a team row is `div.w42d` with its flyout `div.w42sub`.

- Since wave134 one place decides the menu: `WA_NAV.layout` in `parts134/a_head.js`. Home, the Executive dashboard and the Calendar at the top; Departments (the team rows `116` builds from `WA_TEAMS`, with each team's own pages in its row); then Goals and projects, Meetings, Requests and inbox, People, Resources and Admin. Admin's sections (People and access, Security and audit trail, AI models, Adoption, Workspace accounts, Change the Hub) are menu items of their own; the Admin page button stays hidden and carries the access rule. Directors (the board view) get a Board group with Board overview and Committees, and the Events calendar after the Calendar.
- `applyLayout()` runs at boot, after the older rebuilds in `013` and `042` (the `073` rebuild defers to it), and again whenever something moves a button (one observer on `#tabBar`, with a safety valve). The older placement code in `073`, `116d`, `116h`, `124` and `126` defers to it when `WA_NAV.layout` is set, `WA_NAV.register` (`042`) hands new buttons to it, and the observer puts back whatever `095`, `116` and `132` still move. The team-row placements (`116` adopt, `120`, `121`) and the profile row flattening (`127`) are unchanged.
- `114` turns the bar into the left sidebar with CSS only.
- To move a page, change `WA_NAV.layout` only. The page crumbs (`118` `MAST` and the pages' own headers), the access profile editor's `GROUPS` (`parts127`, `parts131`) and the menu step of the chrome tour use the same group names.

## 10. How to add a page

1. **Segment.** Create a `build/partsNNN/` folder with `assemble.py` (or `src/NNN_waveNNN.seg`) as one guarded IIFE, and add it to MANIFEST after `134_wave134`, before `110_wave110`.
2. **Route, panel and menu.** In a `startApp` wrapper, call `WA_NAV.register({ id, label, dot, gate, onShow })` once. Then add the id to the right group in `WA_NAV.layout` (`parts134/a_head.js`); a page the layout does not name lands in Resources. Do not write placement code.
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
| `#mypage` | Home | top level | 009, 074, 075, 089, 105, 112, 115, 116 |
| `#overview` | Executive dashboard | top level | 000, 111, 116g, 116m, 128 |
| `#calendar` | Calendar | top level | 124 |
| `#team/<team>/...` | each team in Departments (Meeting attendance under Upcoming meetings from 144) | Departments | 116, 116b, 116i, 116t, 122, 123, 124, 126, 132, 144 |
| `#volunteering/...` | MTL volunteering (the volunteer survey, the event audit and the sign-ups from 145) | Operations Montreal row | 020, 023 to 026, 031, 106, 119, 119b, 145 |
| `#contentcal` | Content calendar | Marketing row | 121, 118c |
| `#socialstats` | Analytics (with Google Search from 147) | Marketing row | 120, 129, 147 |
| `#fundevents` | Events calendar | Fundraising row | 124 |
| `#finances` | Finances | Fundraising row | 022, 090 to 094 |
| `#hrcentre/...` | HR centre (Meeting attendance for the admins and the Executive profile from 144; the onboarding quizzes from 145) | Human Resources row | 046, 047, 049, 052, 054 to 057, 065, 075, 103, 105, 106, 116p, 144, 145 |
| `#governance`, `#committees` | Board overview (with the board pack card from 143 and board attendance from 144), Committees | Board & Governance row (directors: Board group) | 126, 143, 144 |
| `#agendas` | Agendas | Meetings | 006, 007, 019, 047, 053 |
| `#transcripts`, `#tx/<id>` | Transcript archive | Meetings | 000, 002, 021, 062, 065, 066 |
| `#requests/...` | Requests | Requests and inbox | 005, 050, 065, 123 |
| `#hubmail` | Hub inbox | Requests and inbox | 116h, 123 |
| `#orggoals`, `#goalmap` | Organizational goals, Goal alignment | Goals and projects | 116f |
| `#goals` | Department goals | Goals and projects | 015, 016, 029, 030, 034, 068, 079, 116f |
| `#projects`, `#project/<id>` | Projects | Goals and projects | 116d, 116e; project page 027, 028, 099, 100, 101, 104, 132 |
| `#brain` | The Brain | Goals and projects | 087 |
| `#bank` | The bank | Goals and projects | 132 |
| `#orgchart` | Org chart | People | 011, 012, 133 |
| `#training/...` | Avenue Academy (Learning Avenues, tours, library) | People | 122 (classic view: 036, 037, 044, 045, 057, 058) |
| `#activity` | Activity | Admin | 000, 085 |
| `#adminpanel/<section>` | Admin sections (the monthly security check at the top of Security and audit trail from 146) | Admin | 040, 072, 086, 096, 113, 115, 116l, 116n, 116r, 118, 127, 131, 146 |
| `#importantinfo` | Important info | Resources | 004, 134 (passwords by request) |
| `#photos` | Photo library | Resources | 118c |
| `#ourstory`, `#ourstory/lessons`, `#ourstory/e/<id>`, `#ourstory/<year>` | Our story (timeline and Lessons learned) | Resources | 140 |
| `#partners`, `#partners/<id>` | Partners | Resources | 140 |
| `#documents`, `#documents/q/<words>` | Document finder | Resources | 140 |
| `#create` | Create studio (hidden tab) | team tools | 017, 018 |
| `#dashboard` | alias of the Executive dashboard numbers | hidden tab | 000, 111 |
| `#person/<name>` | none | links | 033, 036, 116c, 116k, 133 |
| `#confirm/<token>` | none (public) | links in texts | 031 |
