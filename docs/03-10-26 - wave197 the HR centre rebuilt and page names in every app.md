# 03/10/26 - wave197: the HR centre rebuilt, and page names in every app

Live md5 1700289a39f06286bf8b228e8d7cf71e (on wave195's 7f576e8e). No database change.

## What Steel asked (02/10/26)

> "it says HR Center too many times ... it should say just the page name maybe. that's for all apps."
> "lots to restructure ... buttons aren't working or aren't consistent. The layout of each page isn't consistent ... some parts of the HR center are repetitive across different pages - like last sign in, commitment ... I'd also like it to be easy to navigate the recruitment process. ... make it easy to manage HR so that Valex can easily navigate this center and do more with less time ... Make sure that each page holds items that are relevant to the name of the page."

His choices: the layout below ("Go with this"); hours from The Loop only (the Slack hours table goes, its data stays); French next (wave198: interface, onboarding and the Avenue Academy, Quebec French, vous).

## What the audit found (live, 02/10/26)

- The app name shown three times on every app page: the sidebar, the app bar ("HR CENTRE > People") and the title.
- Five sections drawn under every HR tab: meeting attendance, onboarding quizzes, scope of work (Slack, empty), time off, Hub engagement (opens and time always 0; Admin's Adoption has sign-ins).
- The hero and its six numbers on every tab, and two intro lines saying the same thing.
- Training also showed Policies and Discipline; #hrcentre/commitment opened People.
- Two hours systems: the Slack one read 0.0h for everyone; the Hub one counted an open session at 52h.
- Recruitment one long scroll (positions, pipeline, playbook, templates, diagrams, then 38 cards with three dropdowns each).
- Buttons in three styles (all-caps gold, pills, squares).

## What changed

1. **Every app.** The title is the page's name (from the rail) wherever it repeated the app's name (CRM, Finance, Fundraising); a page that names itself keeps its title (Servings, Partners). No crumb inside apps. On a computer the app bar goes; its buttons (Add a contact, Text volunteers) are proxied into the page header (`.w197acts`, `data-w197proxy`). Phones keep the bar (its Menu) but without the place name. Admin's in-page section strip is hidden on a computer (the rail has it). Finance's overview title is now "Overview" (parts164 `SECT.overview`). wave153 `items()` now keeps a group's `solo` flag.
2. **The HR centre rail** (`WA_APP.apps.hr.groups` replaced): Overview; People: Team, Hours, Time off, Recognition; Hiring: Applications, Positions, Playbook; Growth: Onboarding, Onboarding plan, Training; Care: Policies, Discipline; Reports: Analytics (HR and admins). Addresses `#hrcentre/<page>`; old ones map (people to team, recruitment to applications, commitment to hours); a bare `#hrcentre` opens Overview.
3. **One page at a time.** The older waves still draw their sections; `tagAll()` tags each with its page (`data-w197s`), `apply()` sets `#hrcentre[data-w197]` and shows only that page's (CSS with !important beats the older tabs' inline styles; anything untagged in the body is hidden until tagged). Hidden for good: the hero, the second intro, Hub engagement (#w93eng), Slack scope (#w103scope), Slack hours (#w52hours), the duplicate assignments card (#w169cardO). A page that needs an older tab's data clicks that tab (S.self) and puts the address back (wave47 rewrites it with replaceState). An older tab pressed by anything else opens the matching page.
4. **Overview** (`#w197ov`): six numbers (team, in The Loop this week, new applications, onboarding, overdue trainings, time off to decide) and Needs HR (new applications, nobody handling, interview or offer, time off, onboarding, overdue trainings, unsigned required policies, below the minimum, worth a check-in from #w144hr), each with Open; Coming up (work anniversaries in 30 days, the newest people).
5. **Applications** (`#w197apps`): a board New, Reviewing, Interview, Offer, Hired (last 90 days); search, role, handled by; drag a card to move it; the sheet (`#w197sheet`) has the stage buttons (with Declined and Withdrawn), the next step, contact, CV (signed URL from hub-mail), the original email, handled by, position, what they wrote, notes. Saves to hub_candidates with change_log, as wave116p did. The old list (#w116pcands) is hidden.
6. **Hours** (`#w197hours`): from hub_checkins (The Loop): this week, last week, average a week against the minimum (hub_settings hours_minimums, editable, change_log), below first; an open session counts at most eight hours; averages count only full weeks since The Loop began (25/09/26), so "below" starts after its first full week. What people shared (loop_feed, 30 days) replaces the Slack scope of work. Meeting attendance lives here.
7. **Consistent look:** every section a card with the same heading; buttons in one family (green primary, outlined secondary); a page's main button in the header only where its own button sits low (Add someone, Log time off, Post a shout-out, Add a policy, Record an entry).
8. **Tour:** `w122.tours.hrcentre` rewritten for the pages.

## Tests

- `test/w197drive.js` 98 checks (admin at 1440 through every page, Overview, the board, the sheet, drag, search, Hours, old addresses, every app's title, an HR member, a member without HR, a phone).
- Updated for the new layout: w152 (CRM title), w153, w164, w176 (Text volunteers in the header), w181 (tour), w193 (Fundraising title).
- Green on the shipped build: w152 68, w153 46, w164 31, w176 14, w181 61, w193 44, w195 52, w197 98; earlier on the same code: w124 35, w151 26, w154 30, w155 22, w156 26, w157 26, w158 23, w158b 25, w159 12, w160 39, w161 21, w177 32, w182 31, w185 16, w190 25, w191 39, w192 79, w134 34, w163 40; w194 40 of 41 (the same on the baseline).
- Note: `build.sh`'s colour check fails on wave195's segment (17 lines; it shipped that way); the build itself is unaffected.

## For later

- The Positions page still shows the Test position and Ian's old onboarding request (closed): tidy in Requests.
- Roster counts differ by design: Team counts the roster (42); Analytics counts the roster plus people on Slack not on it.
