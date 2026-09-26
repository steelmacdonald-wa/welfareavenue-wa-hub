# Hub release checklist

Steel's standing rule (25/09/26): every change to the Hub also reviews the security roles and the Hub training. A wave is not done until all of these are ticked.

## Access and roles
- Every new page is enrolled for the right roles (`WA_NAV.register` gate, `wa40Allowed` wrappers for people with their own tab list) and hidden from the ones that should not see it.
- Access profiles (wave127): add the new page to every profile in `hub_access_profiles.pages` with a decision (`all`, `lead` or `none`), and give it a label and a group in both `parts127/a_head.js` and `parts131/a_head.js` (`LABEL`, `GROUPS`, and `LOCK` if the database enforces it), plus its name in `TAB_LABEL` in `src/110_wave110.seg` so Request more access can offer it. Until then People and access > Profiles lists it under the pages to decide and it follows its built-in gate. Log the decision in the audit trail (`access_profile`, `pages`).
- If the new page shows data that a profile should not read, lock it in the database with `wa_page_ok('<page>')` (as the finance tables and `can_see_board()` do), not only in the menu.
- The profile cards (the "can do" lines) and the "Always true" notes still describe what each profile gives; update them when a flow changes who can do what (wave133 added "Rearrange the org chart" to the Executive and Admin profiles).
- Changes that only some profiles may make go through checked functions with the check inside (as `wa_org_editor()` does for the org chart), never through direct table writes.
- New tables have RLS that matches the page access (staff, board viewers, own rows), checked with a real account where possible (simulated JWT in a rolled-back transaction).
- A new column that hides rows (the bank's `banked_at`): the web app is covered by a restrictive read policy, but edge functions read with the service key and need the same filter; list every `svc.from(...)` read of the table.
- Board viewers: read-only unless the feature says otherwise, and never confidential operational items.
- Run the Supabase security advisor after the database changes: no ERROR findings. Policies never trust `user_metadata` (anyone can edit their own), views run with the reader's rights (`security_invoker`) and carry no write grants, and new functions are not executable by `anon` unless a signed-out page needs them.

## Hub training
- Every new page has a page tour (`w122.tours.<key>`) that walks through each section, and a `trainings` row `tour:<key>` in "Hub page tours".
- Changed pages: the existing tour still highlights every step (`node test/tour1.js all`).
- Lessons or SOPs that describe the changed flow are updated (training 42 for Requests, Hub module 9 for access, and so on).

## Verification
- Drive test for the wave (staff, a member with a custom tab list, board, phone width), plus a profiled member and a profiled lead when the wave touches access (`test/w127drive.js`).
- Harness 36 pages x3 against the live build with the same fixture, churn zero, tours complete, academy drive green.
- Deploy through the gated pipeline, live md5 matches, stage table dropped; afterwards no `wa_stage%` table is left in `public`.
- Docs in `docs/` and the project doc, commit and push.
