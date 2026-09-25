# Hub release checklist

Steel's standing rule (25/09/26): every change to the Hub also reviews the security roles and the Hub training. A wave is not done until all of these are ticked.

## Access and roles
- Every new page is enrolled for the right roles (`WA_NAV.register` gate, `wa40Allowed` wrappers for people with their own tab list) and hidden from the ones that should not see it.
- The role descriptions on the Admin access page say what the new page, data or action gives access to.
- New tables have RLS that matches the page access (staff, board viewers, own rows), checked with a real account where possible.
- Board viewers: read-only unless the feature says otherwise, and never confidential operational items.

## Hub training
- Every new page has a page tour (`w122.tours.<key>`) that walks through each section, and a `trainings` row `tour:<key>` in "Hub page tours".
- Changed pages: the existing tour still highlights every step (`node test/tour1.js all`).
- Lessons or SOPs that describe the changed flow are updated (training 42 for Requests, and so on).

## Verification
- Drive test for the wave (staff, a member with a custom tab list, board, phone width).
- Harness 36 pages x3 against the live build with the same fixture, churn zero, tours complete, academy drive green.
- Deploy through the gated pipeline, live md5 matches, stage table dropped.
- Docs in `docs/` and the project doc, commit and push.
