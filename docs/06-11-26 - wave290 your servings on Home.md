# 06/11/26 - wave290: Your servings this year, on Home, and wave290b: the Next serving card for everyone (built 06/11/26, not released)

Steel (06/11/26): "I need to build something in the hub where it's essentially on the home page. It's the volunteering dates of the year that one has to do before year end. I'm thinking of adding that starting December 1st. Actually, no, November 15th is good." Then, with a screenshot of Home on his phone and the Next serving card circled: "I think it should go somewhere here."

His choices the same day:
- **The year:** the fiscal year, to 30 September. It is the count the onboarding already uses (wave191p: every member volunteers at four servings a year, October to September).
- **Who:** the Montreal team only. Toronto (department `opsto`) and the board do not see it.
- **At four of four:** a thank-you, then the card leaves.
- **Where:** under the Next serving card.

**Not released.** Nothing has been applied to the live database and the live page is unchanged (index.html b8082fba). It goes live only on Steel's yes.

## What staff see

From 15 November each fiscal year, a Montreal team member sees a new card on Home, right under the Next serving card and before Needs your attention and My tasks:

- **The kicker:** "Your servings · until September 30".
- **The count:** "1 of 4 this year", with a gold bar.
- **The line:** "Three more before September 30. Pick the dates that work for you." With none yet: "Every member volunteers at four servings a year, October to September."
- **The next servings:** up to six, each with the date, the time, the place and a partner when there is one. The ones they are already confirmed on are ticked and say "You're on it".
- **What would you like to do?** Serve or Take photos.
- **Confirm my servings:** they are Confirmed right away, and the operations lead (Ahmed today, from the org chart) gets a Request in the Operations Montreal inbox with the dates. Nothing is texted to them. The card then says "You're confirmed for Sunday, November 15. Ahmed has the dates in the Operations Montreal inbox." and counts again.
- **At four of four:** "4 of 4. Thank you!" and "That's your four servings for the year. Thank you for showing up for our community." for seven days from the moment the fourth was confirmed. Then the card leaves until 15 November of the next fiscal year.
- **Nothing open:** "No servings are open right now. Ahmed adds the next ones soon." On every open serving already: "You're on every open serving."

Nobody else sees anything new: not Toronto, not the board or directors, not anyone before 15 November.

## How it works

- **The database decides.** `wa290_home_servings()` answers for the signed-in person. It says no (with the reason) for anyone not staff, without an active team row, in Toronto or on the board, before the start day, or seven days after they reached four. Otherwise it returns what the onboarding picker already reads (`wa191_onb_servings`: the count of the four this fiscal year, the next six servings, the operations lead) with the state (`todo` or `thanks`).
- **The count is the onboarding's.** A serving counts when they are Confirmed on it this fiscal year, past or still to come, and it was not cancelled. Montreal servings only (`kind = 'service'`; Toronto's events are `meal`).
- **The start day** is `app_config` `servings_card_from`, `11-15` (month and day). An admin can move it with one row and no release. A value it cannot read falls back to 15 November.
- **Confirm my servings** calls `wa290_home_signup(p_events, p_role)`. It runs the onboarding's own sign-up (`wa191_onb_signup`), so there is one way to sign a team member up. It only marks the sign-up as from Home, through the setting `wa.signup_via` for that call:
  - the roster row: `confirm.via` and `detail.source` are `home`;
  - the change_log line ends "(Home)";
  - the Request: source `home`, and "From: Home: they are already Confirmed on the roster";
  - a volunteer record it has to create says "signed up for a serving from Home (wave290)".

  Without the setting (the onboarding), everything is exactly as before.
- **The page:** `build/parts290` draws `#w290srv` and appends it to `#mpBody`. `build/parts272/b_home.js` gives it `order: 14`, the same as the Next serving card, which wave171 inserts higher in the page, so the new card always comes second. On a computer the card is full width under the row that holds the Next serving card, with the dates in two columns; on a phone it is one column. It is drawn after its own call, like wave171's card, and put back when Home redraws (renderMyPage, and a light check every 2 seconds that only runs while the card is showing).
- **Craft (Home's rules from wave272):** one quiet surface, 48 px rows with round ticks, press feedback, hover only with a mouse, the bar the only motion, all of it off for reduced motion. Real checkboxes and radio buttons with labels; the roles move with the arrow keys; an error and a confirmation take the focus and are announced.

## wave290b: the Next serving card for everyone, and a shout-out at four (06/11/26)

Steel, the same day: "those that have volunteered 4 times should be given a shout-out on the hub updates. Next to the upcoming up with a sign up button that opens a volunteer form. Or whatever makes it seem less for operations." His choices:
- **Two views of the Next serving card.** Operations Montreal keep theirs; everyone else sees a friendly one with Sign up.
- **The shout-out** goes in the Hub's shout-outs.

**The Next serving card (wave171) on Home, for everyone outside Operations Montreal:**
- **What it shows:** the kicker as before ("Next serving · in 9 days · Home-cooked"), the day, the time and the place (and a partner), then "15 spots still open · 5 confirmed so far", the open roles (four at most, for example "Server 6 · Cook 4 · Driver 2 · Team leader 2"), "You're on this one. Thank you!" when they are, and a gold **Sign up**.
- **What it leaves out:** no confirmation counts by text, no names still waiting, no texting mode, no Open the serving.
- **Operations Montreal** (team or access profile `opsmtl`) keep wave171's card exactly, with a quiet Sign up beside Open the serving. So does the Executive dashboard.
- **Spots:** this serving's own `spot_counts`, else each role guide's `target` (20 a serving today). Filled means Confirmed on the roster, plus an active partner's headcount per role (`covers`).

**Sign up** opens a pop-up, a centred dialog on a computer and a sheet from the bottom on a phone:
- their count this year;
- the next servings, the one they came from already ticked (ones they are on cannot be ticked again);
- Serve or Take photos;
- **Confirm my servings**: the same `wa290_home_signup` as the servings card, so Operations get a Request "From: Home". Then "You're confirmed for ...", and Done.

Escape, a tap outside or Close shut it, and the focus goes back to Sign up.

**The shout-out at four:**
- **When:** every morning at 07:25 in Toronto, `wa290_servings_shoutouts()` (cron `wa-servings-shoutouts`, after the shoutouts job at 07:10) looks for active team members (not the board) who have volunteered at four Montreal servings this fiscal year. A serving counts here once it is completed or its day has passed and they were Confirmed on it. So the shout-out is for servings done, while the Home card counts servings signed up for.
- **What:** each gets one shout-out a fiscal year, "Shima has volunteered at four servings this year. Thank you for showing up for our community!" (`hub_shoutouts`, kind auto, source servings, ten days).
- **Where it shows:** like every shout-out, on the loading screen, in the HR centre and on the Executive dashboard. Nothing goes to Slack, email or a phone.

**Files:**
- `build/data/wa290b_next_and_shoutouts.sql` (`wa290_next_serving`, `wa290_servings_shoutouts`, the cron job) and `build/data/wa290b_undo.sql`.
- `build/parts290/c_next.js` (the friendly view, Sign up and the pop-up), plus small changes in `a_head.js` (the rows' styles shared with the pop-up), `b_card.js` and `z_wire.js`.
- `build/parts171/e_cards.js`: two lines in wave171's `nextHtml` (ask `w290.nextView`; Sign up beside Open the serving). `build/src/171_wave171.seg` is assembled again.
- Tests: `test/w290blive.sql` and `test/w290blive_undo.sql` (live, rolled back), and more of `test/w290drive.js`.

**Checks:**
- **The page:** `test/w290drive.js` passes 58 of 58 (23 new):
  - the friendly card's words and its Sign up of 44 px;
  - no operations detail;
  - the pop-up: a modal dialog, the focus inside, this year's count, the serving ticked;
  - Confirm sends the serving and the role;
  - the confirmation and Done (the focus goes back);
  - Escape, a tap outside, nothing ticked;
  - on it already ("Sign up for another");
  - Operations keep their card with Sign up beside Open the serving;
  - on a phone the pop-up is a full-width sheet from the bottom, with nothing sideways.
- **Regressions** on this candidate: `test/w272drive.js` 152 of 152 (Home), `test/w174drive.js` 21 of 21, `test/w175drive.js` 7 of 7, `test/w182drive.js` 31 of 31.
- **Live, rolled back** (at d11d05a): **ROLLBACK_OK**. The run did all of this, then rolled everything back:
  - wave290, wave290b twice, the checks;
  - the friendly facts for an invented member: the same serving as wave171's card, open spots that add up, signing up makes them "on it" with one more confirmed;
  - Operations Montreal counted as Operations;
  - three served: no shout-out; four: one, as written, and only once; a former member gets none;
  - the undo twice and its checks (the cron job, the functions and the shout-outs gone, wave290 kept);
  - wave290b again and wave290's own checks.

**Release order:** wave290, then wave290b, then the page. **Undo order:** the page, then `wa290b_undo.sql`, then `wa290_undo.sql`.

## Files

- `build/data/wa290_home_servings.sql`: the migration. Safe to run twice.
- `build/data/wa290_undo.sql`: the undo.
- `build/parts290/` (`a_head.js`, `b_card.js`, `z_wire.js`, `assemble.py`) makes `build/src/290_wave290.seg`.
- `build/parts272/b_home.js`: one line (the card's order), so `build/src/272_wave272.seg` again.
- `build/src/MANIFEST.txt`: 290 after 274, before 110.
- `build/candidate.html`: cb8c6d7c (8,212,357 bytes) with wave290b (351a9257 with wave290 alone). The base builds live's b8082fba byte for byte.
- Tests: `test/w290drive.js` (the page, offline), and `test/w290live_before.sql`, `test/w290live.sql`, `test/w290live_undo.sql` (live checks that always roll back).
- `docs/DATA_MODEL.md` regenerated. It also picked up comments from wave274 and wave277 that had not been regenerated.

## Checks

- **The page, offline** (`test/w290drive.js`): 35 of 35 checks pass. They cover the count, the bar, the line, the servings and the ones they are on; nothing ticked; Confirm sends the servings and the role; the confirmation; counted again; a server error; the thank-you; nothing open; no card when the database says no, when the call fails, or for a director; under the Next serving card and before My tasks on a computer and on a phone; nothing scrolls sideways at 390 px; rows at least 48 px; the button at least 44 px; no page errors.
- **Live, rolled back** (`build/sql_rollback_test.py`, through the Supabase connector, 06/11/26, at ba3b58a):
  1. The before snapshot, the migration twice, the live checks: **ROLLBACK_OK**. The checks sign in as an invented Montreal member (Test W290) and cover the following:
     - the patch is in once, with the grants and the comment kept;
     - no card when signed out;
     - the start day: 15 November, a moved day, and the fallback for a value it cannot read;
     - 0 of 4 on the fiscal year;
     - a Home sign-up marked as from Home on the roster row, the Request and the change_log line;
     - the onboarding's sign-up unchanged in the same transaction;
     - four of four thanked for seven days, then gone;
     - no card for Toronto, the board or a former member.
  2. The before snapshot, the migration, the undo twice, the undo checks, the migration again, the live checks: **ROLLBACK_OK**. The undo puts `wa191_onb_signup` back byte for byte (md5 fa51b5d8, the same grants and comment) and removes everything wave290 added.
  - A read-only check afterwards found live as before: the sign-up's md5, no wave290 function, no setting, no test rows.
  - Requests are announced through pg_net, which only sends after a commit, so the rolled-back runs sent nothing to Slack, email or a phone.
- **Regressions:** see the pull request for `test/w272drive.js` (Home) and `test/w191onb.js` (the onboarding picker) on this candidate.

## Release steps (on Steel's yes)

1. Run the two rollback checks again at the pushed commit on the morning's data. Both must answer ROLLBACK_OK.
2. Claude applies `build/data/wa290_home_servings.sql` through the Supabase connector, or Steel runs it in the SQL editor. Check:
   - `wa290_home_servings` and `wa290_home_signup` exist;
   - `wa191_onb_signup` holds `wa.signup_via` once;
   - `servings_card_from` is `11-15`.
3. Publish the page the way wave274 was published: stage the candidate, then the gated swap with live checked first (expected live b8082fba, or whatever is live then, merged and rebuilt), then host-sync.
4. Look at Home as a Montreal team member on a phone and on a computer. Before 15 November there is no card. To see it earlier, set `servings_card_from` to `11-01` for a moment, then put `11-15` back.
5. Add the release record to this document.

The database part can go first: until the page is published nobody calls the new functions, and the onboarding behaves as before.

## Undo

1. **The page:** put back the candidate from before wave290 (b8082fba, or the live one it was merged onto).
2. **The database:** apply `build/data/wa290_undo.sql`. It puts the sign-up function back exactly, drops the two functions and removes the setting. Servings confirmed from Home stay confirmed, and their Requests stay in the inbox.

## Worth knowing

- **What counts:** a serving counts as soon as they are Confirmed on it, even before the day, as in the onboarding. So "4 of 4" can mean signed up for the rest. The thank-you starts when the fourth is confirmed.
- **Who counts as Montreal:** the card follows the team list, not the access profile. Anyone whose team is not `opsto` (Toronto) or `board` counts as Montreal.
- **Toronto:** Toronto's count would need its own rule (its events are `meal` events in the Toronto Volunteer Manager). Not built; Steel chose Montreal only.
- **French:** the new words are translated overnight like every other interface word (wave198).
- **The message box:** Home has none, to keep the card short. The Request says "(no message)". The onboarding keeps its message box.
- **Wave number:** 290. Waves 280 to 286 belong to the CRM work and the Toronto forms. 287 to 289 were left free for the session that was choosing a number at the time.
