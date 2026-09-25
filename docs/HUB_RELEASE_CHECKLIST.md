# Hub release checklist

Steel's standing rule (25/09/26): every change to the Hub also reviews the security roles and the Hub training. A wave is not done until all of these are ticked.

## Access and roles
- Every new page is enrolled for the right roles (`WA_NAV.register` gate, `wa40Allowed` wrappers for people with their own tab list) and hidden from the ones that should not see it.
- Access profiles (wave127): add the new page to every profile in `hub_access_profiles.pages` with a decision (`all`, `lead` or `none`), and give it a label and a group in `parts127/a_head.js` (`LABEL`, `GROUPS`, and `LOCK` if the database enforces it). Until then Admin > Access profiles lists it under "New pages to review" and it follows its built-in gate.
- If the new page shows data that a profile should not read, lock it in the database with `wa_page_ok('<page>')` (as the finance tables and `can_see_board()` do), not only in the menu.
- The profile cards (the "can do" lines) and the "Always true" notes still describe what each profile gives; update them when a flow changes who can do what.
- New tables have RLS that matches the page access (staff, board viewers, own rows), checked with a real account where possible (simulated JWT in a rolled-back transaction).
- Board viewers: read-only unless the feature says otherwise, and never confidential operational items.

## Hub training
- Every new page has a page tour (`w122.tours.<key>`) that walks through each section, and a `trainings` row `tour:<key>` in "Hub page tours".
- Changed pages: the existing tour still highlights every step (`node test/tour1.js all`).
- Lessons or SOPs that describe the changed flow are updated (training 42 for Requests, Hub module 9 for access, and so on).

## Verification
- Drive test for the wave (staff, a member with a custom tab list, board, phone width), plus a profiled member and a profiled lead when the wave touches access (`test/w127drive.js`).
- Harness 36 pages x3 against the live build with the same fixture, churn zero, tours complete, academy drive green.
- Deploy through the gated pipeline, live md5 matches, stage table dropped.
- Docs in `docs/` and the project doc, commit and push.
