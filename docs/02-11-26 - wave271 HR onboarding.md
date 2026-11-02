# wave271: HR onboarding automation, Build 1 (live 02/11/26)

Steel asked (01/11/26) for the HR Center to carry a hire from an accepted offer into onboarding with the setup automated. Design: `claude/01-11-26 - HR onboarding automation, design (wave271).md`; plan: `docs/superpowers/plans/2026-11-01-hr-onboarding-wave271.md`. Steel's yes to release: 02/11/26 ("push these updates", "Okay go for it").

## What is live

- **The offer email** (recruit-actions v10) carries Accept and Decline buttons to `hub.welfareavenue.com/o/<token>`, and saves the reply-by and suggested start dates on the card. "Just reply to this email" stays. The HR sender from wave273 is kept.
- **The `/o/` page** (`build/o/index.html`, served for every `/o/<token>` by `_redirects`, headers like `/c/*`): Accept or Decline (nothing is saved on open; a scanner cannot answer), then a when2meet-style availability grid, English and French, computer and phone. The manager gets their own grid link for the 1-on-1.
- **onboard-link v1** (public, token is the key, CORS to the Hub only): the function behind the page.
- **HR Center > Onboarding** gets **Ready to onboard** above the existing section: who accepted, grid status, the default manager and how it was chosen, a warning when the person has another open application, Offers waiting for an answer ("They said yes by email" sends the grid link), the time picker overlaying both grids with hub@ meetings greyed, the preview (address, department, manager, group session, a fresh Canva link box, the welcome email with its [brackets] filled when read, the steps that will run with switches), and **Start onboarding**. A started card shows each step's result and reason with Retry, "I created it, continue" on the Google step, a Done control on HR tasks, the welcome text with a copy button, and Change time, Change manager, Book the 1-on-1, They backed out.
- **onboard-run v1** (HR or admins): preview, start, retry, google_manual, send_grid_link, set_manager, set_canva_link, task_done, welcome, book_one_on_one, change_time, change_manager, backed_out, and the hourly `remind` (cron `wa-onboard-remind`, 17 past the hour).
- **In Build 1 the Google account, Hub access, Slack channel and welcome email are HR tasks on the card**; the Hub does the roster profile, the onboarding plan (day one = the call date), the calendar invites with Meet links, and tells the manager (notify v28: `onboard_date`, `onboard_grid`, `onboard_remind`, on top of wave274's v17).
- **The onboarding call is day one**: it fills `onboardings.started_at`, `team_members.start_date` (start_source manual) and `hub_candidates.start_date`; "The onboarding call" checklist steps are due on day 0 (were day 3).

## Steel's decisions
Slack: approved email domain (already on). Canva: the invite link goes in the welcome email and HR pastes a fresh one per hire (Canva's links last 30 days; nothing stored in settings). Google: the delegation has every scope (probe 02/11), Steel's account is a super admin, licences are free; automatic account creation is Build 2.

## Database
`build/wa271a_onboard.sql`, `wa271b_remind.sql`, `wa271c_card.sql`, applied 02/11 from commit f35b78a6 (schema_migrations 20261102005001..3). Undo: `build/wa271a_undo.sql` (also removes the 14 `onboard_*` app_config keys: copy `onboard_slack_join_link` and `onboard_google_video` first). New: `hub_onboard_flows`, `hub_onboard_grids`, `hub_onboard_steps` (RLS: HR or admins read; nothing writes from the browser; `pw_nonce` withheld from column grants), `hub_candidates.offer_respond_by` and `offer_start`, `onboarding_assign(p_member_id, p_by, p_start)`, `wa271_ready_list`, `wa271_default_manager`, `wa271_move_start`, `wa271_remind`, `wa166_person_card.starts_on`.

## Build and deploy
Candidate md5 `709e4b06fd06dd49c7ae710ab3ded153` (commit 21c0066, on main cd9f7f7 with wave261, 272, 273), swapped from `3f8e74da…` by the gated block; Netlify deploy 6ae821cc98ae561877ca5ad8. Functions are one-line stubs importing the source from GitHub at commit 8970cca (fn-deploy's token is expired; the Supabase connector deployed). `build.sh` fails on this PC because autocrlf makes MANIFEST CRLF; the join was done in Python and reproduces live md5s byte for byte. The stage file is base64 (`build/wa271_stage.sql`, `.gitattributes -text`): a text stage loses the CRs inside older segments and the gate refuses it.

## Tests
`node --test test/w271*.test.mjs` (213), `node test/w271sql.mjs` (85 checks, PGlite), `cd test && node w271page.js` (77), `CAND=<build> node test/w271drive.js` (147), `check_remaps` clean. The gate's rolled-back dry run on live passed for the migrations; the assertion fixture collides with live's `org_positions_member_uq` (a fixture reuses a member id that holds a live position), test-only.

## Still to do
1. Steel: the live walkthrough with practice applicant 81 (Content Manager): HR Center > Onboarding > Offers waiting > "They said yes by email", open the link from the test inbox, Accept, mark times; then Choose times and preview, Start onboarding. Practice: nothing real is created.
2. Steel: `onboard_google_video` (the Google setup video link) is empty; set it in app_config when there is one.
3. Build 2 (automatic Google account, one-time password page, welcome email, Hub access) and Build 3 (Slack channel) wait for Steel's go-ahead; the plan has them.
4. Deferred minors from the reviews are in the plan's ledger notes; none affects a person today. The old manager's grid link keeps working after Change manager until the 1-on-1 is booked (token is per flow): planned for Build 2.
5. `docs/DATA_MODEL.md` and `docs/EDGE_FUNCTIONS.md` do not list the wave271 objects yet; the HR walkthrough (parts215) does not cover Ready to onboard yet.
6. The team-inbox v17 edits in this checkout (wave274, another session) are uncommitted; live team-inbox is already v17.
