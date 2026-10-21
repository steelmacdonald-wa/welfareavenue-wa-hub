# 21/10/26 - wave262: a simpler Hub for each person, the task pop-up fixed, hashtags

From the 19/10/26 leadership meeting (Loom "Leadership Strategy & Discussion - October 19, 2026", read through the Atlassian MCP).
Steel, 20/10/26: "go for all of these improvements as long as we're not taking functionality away and maybe just storing it in a
place that other individuals could go and get afterwards ... except for maybe the backlog. I do really want everyone to clean up
their tasks", and "make an introduction pop-up to take a tour of how things have changed for each person ... allow them to look
through the apps that are available to them".

## What people see

- **The menu (computers).** Top: Home, Avenue Academy, (Executive dashboard for admins and Shima), Team Requests, Calendar.
  Teams: your own team first; the other teams fold under "Other teams (n)" (shut by default, open by default for admins; the
  choice is remembered on that computer; a team row shows by itself while you are on its page). More: one fold over Other Tools
  (The Brain first, then Important info, the Task Bank, Agendas, the Document finder, the Transcript archive, the Photo library)
  and Organization (Org chart, Our story, Hub inbox); shut until clicked, opens by itself on one of its pages. Nothing left
  the menu or anyone's access.
- **The phone.** The Menu sheet still lists every page; your team now comes first under Teams and your team's apps first.
- **Apps.** The launcher shows Your apps (the Hub plus your team's: Marketing: Content Studio; Fundraising: Fundraising, CRM;
  Operations Montreal: Volunteer Manager; HR: HR centre; Program Development: Strategy), then More apps (everything else you
  can open). Admins and the Executive profile see one list.
- **Home.** What matters first: counts, Needs your attention, My tasks with your team's requests, your meetings, announcements,
  Get started, Policies. Behind "Show everything on Home" (bottom of the card; remembered): who is online, In the loop, Ask the
  Hub ideas, Updates for you, time commitments, Slack notifications, time off.
- **What changed.** Once per person, on Home, after the must-answer pop-ups: what moved for them (their team, what sits under
  More, their apps as buttons that open the app, the task pop-up), with "Take the 1-minute tour" (tour:whatsnew, in the Academy
  under Hub page tours) or "Got it". Directors never see it.
- **The task pop-up (due-date check).** Ian's failure: confirm_due_check re-read the whole list once per task (about 0.56 s each
  for his 68 tasks), so 50 answers hit the 8 s limit and nothing saved. Fixed in the database on 20/10/26 (wa262a, live at once:
  56 answers in about 1.2 s as Ian, rolled back). The page now saves in batches of 15 and keeps what earlier batches saved if
  one fails. Long sections get "All in this section: Done / Next meeting". Tasks due today join the check ("Due today: done,
  still on for today, or a new date?", kept for today by default) until confirmed that day. The cleanup stays mandatory.
- **Hashtags (Content Studio).** #studio/hashtags: public Instagram posts under watched hashtags (#onebagchallenge seeded),
  checked every 30 minutes and on Check now; each marked Looks fine, Needs attention or Reported. Instagram only (Facebook and
  TikTok have no hashtag search); Instagram allows 30 different hashtags a week; ten watched at most.
- **Tate** leads Operations Toronto in the Hub (the lead option of his profile, as Ahmed and Shima have). That lead option also
  opens Agendas, Activity, the HR centre, the Content calendar, Analytics, the board pages and Committees, as for the other leads.
  The org chart stays with the Executive and Admin profiles.
- **Ask the Hub finds pages (Steel, 21/10/26).** A question that asks where something is gets a "Where to find it" box under
  the answer: up to three matching pages, where each sits in the menu and Open, or Request access for a page the person's access
  does not open (a wa_access_requests row, wanted tab:<page>, reason "Asked Ask the Hub: ...", and the same admin ping as Request
  more access on Home; then "Requested, waiting for an admin"). Client side only (parts262/d_nav.js); ask is unchanged.
- **Onboarding.** A lead's step "Walk them through the Hub, live (30 minutes)" (hrm05, day 3); the Loom step names
  hub@welfareavenue.com.

## Files

- Hub: `build/parts262/` (new: Home focus, What changed and its tour), `build/parts134/` (folds, showPanel follow), `build/parts153/`
  (Your apps, Hashtags in the studio rail), `build/parts163/c_phone.js`, `build/parts213/a_duecheck.js`, `build/parts225/n_hashtags.js`
  (new) with a_head, z_wire, k_tours, assemble; `build/parts127/`, `build/parts131/` (The Brain in Other Tools), `build/parts122/f_tours.js`
  (menu and Home tours), `build/src/118_wave118.seg` (The Brain's crumb), MANIFEST.
- Function: `fn/hashtag-watch/` (new).
- Data: `build/data/wa262a_confirm_fast.sql` (applied 20/10/26), `wa262b_due_today.sql` (with the build: due today, tour row,
  Hub module 1 wording, Tate, onboarding step), `wa262c_hashtags.sql` (tables, functions, seed, cron).
- Docs: `docs/EDGE_FUNCTIONS.md` (hashtag-watch, the cron), `docs/HUB_RELEASE_CHECKLIST.md` (the folds rule).

## Release (21/10/26)

- Live: index.html `aec989a28cf7116f419a49396e3ac93e` (from `1cecc2a3`), host-sync 18:41 UTC, the hosted page checked byte for
  byte. GitHub main `18a784e6` on `525b38a9` (94 files).
- Database: wa262a applied 20/10/26 through the Supabase connection. The rest went in through Steel's SQL editor because Claude's
  write approvals were being cancelled: step 1 (stage table wa_stage_262 and wa262c hashtags), step 2 (the gated swap of site_files,
  wa262b, the release line, the stage table closed). The parts were posted from the build with the anon key and checked against
  the gate's md5s before Steel ran it. The hourly sweep drops wa_stage_262.
- Steel ran step 3 (cron wa-hashtag-watch, :07 and :37). His dashboard deploy made a function `swift-api` holding Supabase's Hello
  template (left in place for Steel to delete); Claude deployed hashtag-watch through the Supabase connection (v1, then v2: posts
  from a week before the tag was added onwards). First check: Instagram knew #onebagchallenge (id 17841519709076422); its 50 top
  posts (2013 to March 2026, none ours) were removed; 0 recent posts so far.
- Tests: w134 34/34 (updated for The Brain in More), w163, w153, w225 47/47, w260 49/49; w127 fails the same way on the old live
  build (fixture drift); new checks for the folds, Home, apps, the due-date check (a failed batch mid-save), Ask the Hub's box,
  the pop-up and its tour, desktop and phone.
