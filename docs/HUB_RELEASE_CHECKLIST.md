# Hub release checklist

Steel's standing rule (25/09/26): every change to the Hub also reviews the security roles and the Hub training. A wave is not done until all of these are ticked.

## Access and roles
- Every new page is enrolled for the right roles (`WA_NAV.register` gate, `wa40Allowed` wrappers for people with their own tab list) and hidden from the ones that should not see it.
- Access profiles (wave127): add the new page to every profile in `hub_access_profiles.pages` with a decision (`all`, `lead` or `none`), and give it a label and a group in both `parts127/a_head.js` and `parts131/a_head.js` (`LABEL`, `GROUPS`, and `LOCK` if the database enforces it), plus its name in `TAB_LABEL` in `src/110_wave110.seg` so Request more access can offer it. Since wave134 the `GROUPS` are the menu's groups; put the page in the same group as in `WA_NAV.layout`. Until then People and access > Profiles lists it under the pages to decide and it follows its built-in gate. Log the decision in the audit trail (`access_profile`, `pages`).
- If the new page shows data that a profile should not read, lock it in the database with `wa_page_ok('<page>')` (as the finance tables and `can_see_board()` do), not only in the menu.
- The profile cards (the "can do" lines) and the "Always true" notes still describe what each profile gives; update them when a flow changes who can do what (wave133 added "Rearrange the org chart" to the Executive and Admin profiles).
- Changes that only some profiles may make go through checked functions with the check inside (as `wa_org_editor()` does for the org chart, and `info_decide()` for passwords), never through direct table writes.
- New tables have RLS that matches the page access (staff, board viewers, own rows), checked with a real account where possible (simulated JWT in a rolled-back transaction).
- A column that must never reach the browser (a password, a token) is left out of the column grants and served only by a checked function that logs each read (as `info_links.secret` and `info_secret()` since wave134).
- A new column that hides rows (the bank's `banked_at`): the web app is covered by a restrictive read policy, but edge functions read with the service key and need the same filter; list every `svc.from(...)` read of the table.
- Board viewers: read-only unless the feature says otherwise, and never confidential operational items.
- Run the Supabase security advisor after the database changes: no ERROR findings. Policies never trust `user_metadata` (anyone can edit their own), views run with the reader's rights (`security_invoker`) and carry no write grants, and new functions are not executable by `anon` unless a signed-out page needs them.

## Structure (since the wave134 audit)
- **Edit the sources, never the build.** Segments in `build/src/` or a parts folder, assembled by its `assemble.py`; `build.sh` runs `check_remaps.py`, which fails on a legacy colour or an old team label. A new segment goes in `MANIFEST.txt` after `134_wave134` and before `110_wave110`, with a `#` note if its position matters.
- **Menu position:** add the page id to its group in `WA_NAV.layout` (`build/parts134/a_head.js`), and nowhere else. No placement code, no observers on `#tabBar` that move anything (wave163's only watch), and nothing that shapes the menu on a timer after `startApp`: the menu shows once, when the `startApp` chain has run (wave163), and `w163.state().after` stays 0 in `test/w163drive.js`. The page's crumb (`118_wave118` `MAST` or its own header) names the same group, and `window.w134.ok()` stays true in the drive test. An app's page goes in `APPS` (`parts153/a_head.js`), the `apps` group of the layout and wave153's hide rule. The phone sheet (wave163b) reads the menu, so a new page shows there by itself; check it at 390 px.
- **Database:** every new table, view and function, and every column whose meaning is not obvious, gets a `COMMENT` in the same migration: what it holds, who writes it, who may read it (and "use X instead" for anything legacy). Team columns hold the `dept_meta` codes; new id columns get a foreign key and an index; code-like columns get a CHECK. Then regenerate `docs/DATA_MODEL.md` with `python3 build/gen_data_model.py`.
- **Edge functions:** the source and `meta.json` in `fn/<name>/`, deployed with `build/fn.py`. AI calls only through the `llm` router (`x-wa-task` with a route in `ai_routes`, `x-wa-caller` with the function name), never `api.anthropic.com`. Team lists carry all seven codes (read `dept_meta` where possible). Anything that deletes, posts or searches widely checks admin or leader inside, not only the staff email domain. The header says purpose, trigger, auth, actions, tables and side effects; add the function to `docs/EDGE_FUNCTIONS.md`.
- **Slack and email:** no new automated Slack post, DM or email without Steel's explicit OK, and none from a test.

## Hub training
- Every new page has a page tour (`w122.tours.<key>`) that walks through each section, and a `trainings` row `tour:<key>` in "Hub page tours".
- Changed pages: the existing tour still highlights every step (`node test/tour1.js all`).
- A menu change: the menu step of the chrome tour names the groups as `WA_NAV.layout` does.
- Lessons or SOPs that describe the changed flow are updated (training 42 for Requests, Hub module 9 for access, and so on).

## Verification
- Drive test for the wave (staff, a member with a custom tab list, board, phone width), plus a profiled member and a profiled lead when the wave touches access (`test/w127drive.js`). New drive tests boot with `test/boot.js` (`fresh(browser, { who, width, hash, init, rpcs })`).
- Harness 36 pages x3 against the live build with the same fixture, churn zero, tours complete, academy drive green, and `test/w134drive.js` green (the menu layout for every identity).
- Deploy through the gated pipeline, live md5 matches, stage table dropped; afterwards no `wa_stage%` table is left in `public`.
- Docs in `docs/` (and `DATA_MODEL.md` regenerated after a migration) and the project doc, commit and push.
