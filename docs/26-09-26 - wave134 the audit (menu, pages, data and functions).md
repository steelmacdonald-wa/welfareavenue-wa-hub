# 26/09/26 - wave134: the audit (menu, pages, data and functions)

Live md5 `c0762ca2f0c1a2b41af427d09158e5ff` (3,834,008 bytes), deployed through the gated pipeline in two steps: the wave (`wa_stage_rd`, md5 `c7e597b7`, guarded on the live md5 `1ed9af92`) and a text follow-up for the How work happens walkthrough (`wa_stage_re`, guarded on `c7e597b7`); both stage tables dropped after. Schema: `wa134_schema` (team labels, foreign keys, indexes, CHECK rules, function grants), `wa134_comments` (the schema explains itself), `wa134_passwords` (passwords by request) and `wa134_training`. Sixteen edge functions redeployed. Two earlier commits belong to this wave: `5d834f8` (the source is what ships) and `9a3ff2f` (the 17 functions that existed only in Supabase are in the repo).

## What Steel asked

"ASK THE HUB should have an animation that the E in THE should expand instead of the E alone on the left", then a full audit of the website, the database and the front end: data "structured in a well structured way where agents can understand it very well, dev can understand it very well", nothing repetitive across the pages, and the menu regrouped ("the department section is well formatted because it just has the departments but the other sections like strategy and other and admin like maybe regroup those into different categories on whatever makes sense"). "Go ahead and make the changes right away on the ones that are obvious and the big changes that you know. Just let me know and I'll make the decision."

Along the way: the check-in note should say "Don't forget to check in"; "By default the important info section with passwords should be there for everyone and if they want to see a password they must request it"; Daniela now works on the board; Leah Lopez has left; and "It would be nice to have an easy option to switch the site to french, is that possible?" (an answer is in the decisions, number 5).

## What people will notice

**Ask the Hub.** At rest the button is the brand E. On hover or keyboard focus, "ASK TH" and "HUB" open around it and its bars stretch, so the E becomes the E of THE. It sits on the baseline with the capitals (measured), and it stays still for people who turn motion off.

**The menu, regrouped.** One list now decides it (see "One place places the menu" below):

| Where | What |
|---|---|
| Top | Home, Executive dashboard, Calendar (and the Events calendar right after it for people who cannot open the Fundraising team page) |
| Board | Board overview and Committees, for directors; people who can open the Board & Governance team find them in its row, as before |
| Departments | unchanged: each team with Overview, Agenda, Tasks and its own pages |
| Goals and projects | Organizational goals, Department goals, Projects, Goal alignment, The Brain, The bank |
| Meetings | Agendas, Transcript archive |
| Requests and inbox | Requests, Hub inbox |
| People | Org chart, Training academy |
| Resources | Important info, Photo library |
| Admin | its sections as menu items (People and access first, then Security and audit trail, AI models, Adoption, Workspace accounts, Change the Hub), and Activity |

Strategy, More and the loose Requests button are gone. A group shows only when it holds something the person can open (a member has no Admin group; a leader's Admin group is Activity only). Page crumbs, the access profile editor's page groups, the menu tour and the help popups use the same names.

**Important info: passwords by request.** The page stays open to everyone on staff, links and notes included. A password shows only to admins, to whoever added it, and to people an admin has approved. Anyone else sees Request access (with an optional reason) and then "Requested, waiting for an admin". Admins see the requests at the top of the page with Grant and Decline, a count on the Important info menu item, how many people can see each login (with Revoke) and Give access. Every view, request and decision goes in the audit trail. The password column can no longer be read through the API at all; it comes only from a checked function.

**The check-in note** says "Don't forget to check in" (Check in, Not now).

**The Executive dashboard.** Coming up no longer repeats what the brief's Next up already shows (the next board meeting, event and serving).

**The roster.** Daniela is with the board of directors (Treasurer): off the Fundraising & Finances team and its org chart seat, shown with the board on the org chart. Leah Lopez has left: inactive, and her seat on the org chart is an open position ("Was Leah Lopez's seat"). She had no Hub account.

**Fixes the audit found:**

- The volunteer confirmation link (`#confirm/<token>`) never loaded (it waited for `window.db`, which never exists); it loads now.
- Text from the database is now escaped inside HTML attributes too (`esc()` and `escapeHtml()` escape quotes). A stray quote from an email, Slack or a transcript could break a page or inject an attribute.
- HR centre: the open hiring requests count and the open positions list can read the requests now (they were always empty), and HR people who are not admins can see and edit start dates.
- Ask the Hub's editable request proposal lists the request types (the list was always empty).
- Accepting or declining a meeting updates its cached status; tasks closed while checking out show as closed right away; moving an SOP step is now logged (it never was).
- Help popup titles use the current page names; a page registered twice is kept once.
- The How work happens walkthrough (shown to new joiners and from The Brain) named pages that no longer exist ("the Decisions page", "the map on Strategy"); it now says the Transcript archive under Meetings, the Executive dashboard, and Goal alignment.
- Boot does less: the ClickUp weekly table (unread since wave116g) is no longer loaded, and the agendas page makes one roster request instead of eight.
- AI outages: transcript-requests, finance-import and hub-edit still called Anthropic directly, and that account is out of credit, so they failed (finance-import on the 25 Sep statement). They now go through the model router like every other AI job. transcript-requests no longer marks a meeting as scanned when every model pass failed, so a failure is retried on the next run.
- Program Development was missing from the team lists of 12 edge functions: the leadership pipeline, the upload preview and the request suggestions could never file anything under it, and the digests printed "undefined" for it. The old team names in prompts ("Fundraising and Grants", "Ops and Program Dev Montreal") now match the Hub.

## What changed underneath (for developers and agents)

**The source is what ships** (`5d834f8`). The brand palette and team label remaps used to rewrite the page after assembly; they are baked into all 137 source files, the build is byte-identical, and `build.sh` runs `check_remaps.py`, which fails the build if a legacy colour or an old label comes back. `MANIFEST.txt` accepts `#` comment lines. The one-off generators `w117_gen.py` and `w118_gen.py` are archived (the segments are the source).

**One place places the menu.** `WA_NAV.layout` (in `134_wave134.seg`, from `build/parts134/`) lists where every page sits. `WA_NAV.applyLayout()` moves the existing buttons (it never rebuilds them, so their wiring holds), rebuilds the Admin section links if older code dropped them, and a watcher re-applies it if older code moves something (with a safety valve). The older placement code in waves 73, 116d, 116h, 124 and 126 defers to it when it is on, `WA_NAV.register` hands new buttons to it, and whatever waves 95, 116 and 132 still move, the watcher puts back. A new page's menu position goes in `LAYOUT` and nowhere else; `window.w134.ok()` says whether every page is where the layout wants it.

**Guides for people and agents** in `docs/`:

- `ARCHITECTURE.md`: how the page is built and deployed, the segment order and why, the conventions (WA_NAV, access, tours), and where to change what.
- `DATA_MODEL.md`: every table, view and function grouped by area, with its comment, columns, keys and relationships. Generated from the live schema by `build/gen_data_model.py`, so it is regenerated after each migration.
- `EDGE_FUNCTIONS.md`: all 54 functions and the 21 scheduled jobs, with purpose, trigger, auth, state and what is next for each.
- `docs/audit/`: the three audit reports (front end, edge functions, database) with their evidence, plus `fe_pages.json` (every page and route, what it reads, who can open it) and `db_inventory.json`. `docs/audit/README.md` says what each holds and which findings are done.

**The database explains itself** (`wa134_schema`, `wa134_comments`):

- Every table (121), view (3) and function (111) has a comment saying what it holds or does, who writes it and who may read it, and so do the 438 columns that need one (codes, legacy fields, "use X instead" notes).
- `dept_meta` is the list of the seven team codes with their label, short label, menu order and colour, so code and agents can read it instead of the 27 label maps.
- 24 new foreign keys where the ids already pointed somewhere (checked first: one directory row pointed at a deleted roster id and was unlinked), so the relationships are visible and kept by the database. Every single-column foreign key now has an index.
- CHECK rules on `hub_roles.role`, the `visibility` columns and the social `platform` columns.
- Functions a signed-out visitor never needs are closed to them: `onboarding_assign` (which now also checks for staff), `ai_usage`, `ensure_event_steps` and `sop_sync_all_events`.
- Additive only: nothing was dropped, renamed or deleted.

**Edge functions:**

- The repo matches live, 54 of 54 (`9a3ff2f`), with one redaction (below).
- `sop-import` is retired (it answers 410): running it again would overwrite the serving SOP edited in the Hub since July, and its live code carried a shared volunteer password as a scrub pattern (the committed copy says REDACTED).
- Gates tightened: `mail-pull` probe and test (any Gmail search of the hub@ mailbox) are admins only, and undo and refile (which delete or move what an email created) are leaders and admins; `social-pull` disconnect (which deletes an account and, by cascade, its analytics history) is admins only; `repo-sync` (commits to GitHub) answers only the build pipeline's secret.
- Versions: transcript-requests v8, finance-import v7 (route `finance_import`, Claude models, which read PDF statements), hub-edit v2, process-leadership v5, transcript-preview v5, weekly-digest v3, daily-alerts v3, slack-digest v3, build-agenda v9, project-slack v7, slack-command v3, ask v13, mail-pull v9, social-pull v9, repo-sync v4, sop-import v2.

**Tests:** `test/boot.js` boots the page for any identity, width and hash (with the brand fonts in `test/fonts/`), and `test/w134drive.js` uses it. The wave130 and wave132 drives follow the new menu.

## Release checklist

- **Access:** no page changed hands. The regroup moves buttons only; what each profile opens is unchanged, and the access profile editor groups pages the way the menu does. Important info stays open to every profile that had it; passwords follow the request flow, enforced in the database (`info_link_access`, `info_secret`, `info_request`, `info_decide`, `info_grant`; the secret column is not readable through the API, and whoever adds a login is granted it by a trigger).
- **Training:** the menu step of the Hub tour names the new groups (and the Needs me step, whose button has been hidden since wave116, is gone); the admin tour says its sections are at the bottom of the menu, under Admin; the Important info tour and help explain passwords by request, with a step for the admins' requests panel; the Hub module that placed The bank "under Strategy" now says "under Goals and projects" (`wa134_training`).
- **Security review** (the advisor, after the deploy): no ERROR findings. The WARNs are known ones: 49 SECURITY DEFINER functions are callable by anon (53 before this wave; most are trigger functions or helpers, the rest are in the decisions), and leaked password protection is off in Supabase Auth. Eight service-only tables have row-level security with no policy, by design. No stage table is left.

## Verification

- `test/w134drive.js`, 37 of 37: the menu for an admin, a leader, a member and a director (every page where the layout says, no Strategy or More group left, the Admin sections as items, the seven teams kept, crumbs named after the groups), Ask the Hub at rest and on hover, the check-in note, passwords by request (a member asks with a reason, the admin sees the request and the count, grants, and Show fetches the password), quotes escaped, the confirmation page, Coming up without repeats, and no page errors.
- Regression: the drives for waves 133 (43), 132 (52 and 48), 131 (46), 130 (30), 122 (36 of 36), 116k and 116m are green; the harness for three identities differs from the previous live build only where intended (the menu, crumbs, Important info and Coming up); churn is clean; the Hub, Important info, org chart and person page tours walk to the end; phone widths fit.
- Database: each migration ran first as a dry run in a rolled-back transaction (the foreign keys valid with no orphans; the password flow for a member, the person who added a login, an admin and an outsider; anonymous reads refused).
- Edge functions: each parsed before deploy, and the live versions match the repo. The three router moves have not run live yet: transcript-requests calls the model when a new meeting arrives, finance-import on the next statement upload, hub-edit on the next Change the Hub edit. Their calls will show in Admin > AI models.
- Live: the md5 matches the build after each step (`c7e597b7`, then `c0762ca2`) and the page boots with no errors. The follow-up changed three sentences of the walkthrough only (a diff against the live copy shows nothing else); the drive test stayed 37 of 37 and the walkthrough shows the new text with no errors.

## Decisions for Steel

Each has a recommendation. Nothing here has been done.

**Pages**

1. **Goals in one place.** Organizational goals, Department goals and Goal alignment are three pages about the same goals, and The Brain's map draws how work connects to them too. Recommend: one Goals page with three views (the organization, the departments, the alignment map).
2. **Waiting decisions on the Executive dashboard** appear four times before the full list (the brief, a tile, Needs a decision, and To watch). Recommend: keep the brief and Needs a decision; drop the tile and the To watch line.
3. **Activity and the audit trail.** Activity (leaders and admins) and Admin > Security and audit trail both list every change from the same log. Recommend: one list, the audit trail, with a recent-changes view for leaders.
4. **The classic department pages** have been hidden since wave116 but are still built at every boot (about 914 KB of HTML, 18,470 elements nobody sees), with "classic view" switches behind them. Recommend: stop building them and retire the switches; the Hub loads faster.
5. **French.** Two options. Now, at no cost: a "Read the Hub in French" tip (Chrome and Edge translate the whole page, including what the Hub adds as you click). Later: a real French and English switch for the Hub's own words (menu, buttons, titles, help, tours); what people type stays in the language they wrote it in. The switch is much cheaper after decision 6, because the Hub's words are spread over about 150 files today. Recommend: the tip now, the switch after 6.
6. **One page registry and a shared toolkit.** Each page's name, group, crumb, help, tour and access label live in eight places, and every wave rewrites the same helpers (69 role checks, 86 date helpers). Recommend: yes, in stages over the next waves.

**Data**

7. **Task status.** 261 of the 324 finished tasks still say Open, New or In progress in `status`, so anything that reads it misreports open work. Recommend: set it from `done`, move the notes into their own field, and allow a short list only.
8. **People by id, not by name.** Tasks, mentions and training progress name people as text, and 38 of the 48 roster names are a single first name. Recommend: add the roster id next to each name, starting with task owners.
9. **The "org" team code** is used by 284 rows but is not one of the seven teams. Recommend: make it an eighth code, Organisation-wide, then lock every team column to the list.
10. **AI-made rows point at their meeting by its title**, so renaming a transcript breaks the link. Recommend: link them by id.
11. **Backups inside the live database** (two backup schemas with 71 tables, 6.8 MB, plus two frozen tables) and four dead tables (`item_status`, `plaud_seen`, `wa_loom_stage`, `wa_usage`). Recommend: export them to the backups bucket, then drop them.
12. **Settings and a stored login.** Two settings tables, plus `staff_notes`, which holds the shared Quo login that the volunteer messaging screen shows to all staff. Recommend: one settings table; move the login into Important info (now by request) and drop `staff_notes`.
13. **Shared filters for jobs.** Confidential, board-only, banked and visibility rules are re-implemented in each edge function. Recommend: views that apply them once (for example open visible tasks) for every job to read.
14. **Clearer names** (`hub_events` to `calendar_events`, `fund_events` to `fundraising_events`, `wa_onboarding` to `hub_first_steps`, `dept_meta` to `teams`), with the old names kept working for a while. Recommend: later, in one rename window.

**Privacy, Slack and jobs**

15. **The Drive index.** It holds the text of 10 board documents and 35 contracts and budgets; any staff account can read it, and the Brain quotes it without the board filter it uses elsewhere. Recommend: now, hide board documents from people outside the board and have the Brain skip them; then choose which Drive folders the Hub should index.
16. **Blocked people.** 44 functions let any @welfareavenue.com sign-in through; 5 people are blocked in the Hub and 2 of them still have sign-in accounts. Recommend: one shared check that refuses blocked people, and remove those 2 accounts.
17. **Who can post as the Hub.** The check-in "say" action posts to any public channel, the welcome kit DMs any colleague, and quo-send texts up to 200 people, for anyone on staff. Recommend: leaders, HR and admins only.
18. **Slack fixes that change what gets sent:** (a) the onboarding "I need help" button has never notified anyone (a broken call); fixing it means a Slack DM to HR when someone asks; (b) invited people get the welcome DM twice; (c) four Monday jobs post to the same channel within 100 minutes. Recommend: yes to all three (one Monday digest for c).
19. **The 25 Sep meeting.** Its scan ran while the model was down and was marked done with nothing found. A re-run finds its requests, due dates, wins and mentions, and sends the mention DMs in Slack. Recommend: yes.
20. **slack-pull** reads one person's Slack DMs with their token (and turns work items from them into transcripts staff can read), and it has not completed since 24 Aug. Recommend: retire it, or keep it for channels only.
21. **Legacy functions:** import-images, dashboard, site, attach-rehost, quo-sync and clickup-pull (and its Monday job; nothing reads its line). Recommend: retire them.
22. **Job health.** Scheduled jobs always look successful, even when the function fails (the cron only queues the call). Recommend: log each job's real result and show failing or stale jobs on an Admin card (no Slack); run social-publish every 15 minutes instead of every 5.
23. **Merges:** the three digests into one, goal-propose with goal-suggest, one transcript pipeline, the Quo functions, and notify as the one Slack sender, on a shared module. Recommend: yes, in stages, starting with the digests.
24. **The Brain's reach.** Ask the Hub reads about 12 tables; the org chart, the calendar, the Hub inbox, the board pages, the academy and the photo library are invisible to it. Recommend: widen it after decision 15.

**People**

25. **Daniela's access.** She is a director (Treasurer, in the board circle) and has no access profile. Recommend: the Board member profile, plus Finances if she still handles the books.

**For your list (no decision needed)**

- Change the shared volunteer password that sat in sop-import's live code (the function is retired and the repo copy is redacted).
- The 25 Sep bank statement import failed during the outage; upload it again whenever it suits (you said statements will be imported).
