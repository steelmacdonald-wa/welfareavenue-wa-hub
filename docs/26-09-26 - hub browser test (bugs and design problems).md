# 26/09/26 - Hub browser test: bugs and design problems

Steel asked: "play around with the hub in the Claude browser and test it to its limits, determine bugs and design problems and list them to me." Read only: nothing was changed while testing.

**Status (26/09/26):** bugs 1 and 5 to 15 are fixed in wave130 (see "26-09-26 - wave130 browser test fixes"); bugs 2 to 4 are fixed by the People and access redesign (wave131). The content clean-ups Steel approved are done; the donations tile waits for the statements.

## How it was tested

The Claude browser was not connected to this session, so the test ran in a sandboxed Chromium on the live build (md5 `dc8c3c44`), with the network cut off and every database call answered from a test snapshot (part live data, part test data). Nothing could reach the real data.

- Every page the Hub links to, found by following every link and door (140 routes per run), as Steel (admin), a staff member and a board viewer, at desktop (1366 px) and phone (390 px) widths: page errors, console errors, sideways scrolling and its cause, controls covered by something else, clipped text, small tap targets, duplicate ids, what a first visit shows.
- A click pass: 516 buttons on the 50 main pages pressed once, looking for errors and dead controls. None threw in a way that would happen in a real browser (the two that did were the test set-up: no clipboard on a plain http page, and the test's clock), and the controls that seemed to do nothing were scrolls, tabs already open, phone and email links, and confirmations the test declined.
- Four reviewers went through the screenshots page by page (two on desktop, one on the phone, one on the board view). Every data claim below was checked against the live database, and the layout claims against fresh screenshots; claims that came from the test snapshot rather than live data were dropped (see the end).

No page threw an error at any width or role.

## Bugs to fix

1. **Phone: four pages scroll sideways.** Activity (the "Everyone" filter lists emails and is 422 px wide), The Brain (the "Focus a goal" menu, 413 px), Admin > Security and audit trail (the "Everyone" filter) and a person page (the onboarding row "30 of 30"). The whole page, bottom bar included, slides left and right. Fix: cap menus at the card width and let the row wrap.
2. **Admin > People and access spills off the screen at 1366 px.** The roster table is wider than its card: the page scrolls sideways, Invite and Remove are cut at the right edge, the actions column has no heading, and names wrap in a narrow Person column. Fix: keep the table inside the card, put the actions in one menu, give Person the width.
3. **Phone: access requests cannot be granted.** Under Access requests the Grant button is a gold sliver at the card edge and Deny is off screen. Fix: stack the request and put Grant and Deny under it.
4. **Admin > Access profiles hides most of its matrix.** "Every page, profile by profile" sits in a box capped at 78% of the screen with its own scroll and no sign of it, so it looks like it ends after "Operations Montreal"; the other teams, Finances, Hub inbox, HR centre, Admin and the board pages are below the fold of the box. Fix: let the page scroll, or show a fade and "12 more pages".
5. **Hub inbox shows its header twice** ("Hub inbox" with two different subtitles). Fix: one header.
6. **Board view: staff pages quietly become the Executive dashboard.** A board viewer who opens Finances, Department goals or another staff page (from a link, a breadcrumb or a chevron) lands on the Executive dashboard with the old address still showing and no explanation. Only Important info says "available to staff accounts only". Fix: the same notice everywhere, with a link to Board overview, and hide links the board cannot open.
7. **Board view: decisions have tick boxes.** Under a "read only" banner, the Executive decisions list shows a tick box on each decision and "Tick an item when it is decided". Fix: hide them for board viewers.
8. **Board view: the calendar says nothing is coming.** The Calendar has no board layer, so a director reads "Nothing coming up in the next five weeks" while the Q3 board meeting (October 19) and the committee deadline (October 12) are inside that window. Fix: a Board layer (meetings, committee deadlines, the year-end), on by default for directors.
9. **Upcoming servings show as codes.** The next servings have no title in the database, so the Executive dashboard's Next up and Coming up read "WA-26-21", "WA-26-22". Fix: show "Sunday serving, Montreal" when there is no title (the Calendar already does).
10. **The floating Ask the Hub button covers working controls** at 1366 x 900 and on phones: the HR centre shout-out Post button, a Remove link in People and access, project rows on team pages, "all SOPs" links, rows in To watch. Fix: bottom padding under every page, a smaller round button, hidden while typing.
11. **First visit: two coach marks at once**, plus the Get started card. "Starting a session?" covers the top-right tile and "Meet Ask the Hub" covers the button of the last Get started item. Fix: one at a time, placed away from the content.
12. **"Request more access" shows for admins** on My page, and flashes before the page settles. Fix: hide it for admins.
13. **Phone: policy sign-off sits on top of "Open and read".** The two buttons touch, so a slightly-off tap signs the policy; the "signed 2026-08-01" pill breaks over two lines. Fix: stack with a gap, and only enable sign-off after the document is opened.
14. **"Refresh the recommendation" on a team page updates a hidden copy.** The team's decisions card is drawn twice, in the hidden classic department page and on the new team page, with the same ids (`rec-fundraising-11`), and the refresh writes into the first one, the hidden copy, so the visible card does not change until the page is reloaded. Fix: draw it once, or give the team page's boxes their own ids.
15. **Footnotes half outside their card** on Department goals ("23 of 25 department goals shown…"), Goal alignment and Organizational goals, with no left padding.

## Design problems

1. **Phone: desktop tables squeezed into the screen** (Access profiles shows two of nine columns, the audit trail two of four, HR centre's scope-of-work table); hidden cells stretch rows into long blank gaps. Use stacked cards on phones.
2. **Phone: Goal alignment is unreadable** (three columns of about 100 px, the org goals cut at the edge). Show one column at a time, or an org goal > department goal > project list.
3. **Phone: the bottom bar highlights nothing** on team, person, goals, HR or admin pages. Map every page to Home, Dashboard, Teams or More.
4. **Phone: a grey strip down the left edge**, the shadow of the closed side menu.
5. **Phone: small tap targets** for breadcrumbs, "Got it", "Hide for now", delete crosses on Important info and shout-outs.
6. **Executive dashboard:** the same decisions twice (Needs a decision and Executive decisions); decisions numbered by position with gaps ("10., 11., 14., 17., 20."); Next up in category order rather than date order (Oct 19, Nov, Oct 4) with a "Nov / MONTH" chip; the Delivery numbers folder opens a second full page header in the middle of the page.
7. **Board navigation:** "Departments" holds Content calendar and Analytics and no department; "More" holds one item; on a phone Home and Dashboard open the same page. A board menu (Board overview, Committees, Calendar; Organization: Executive dashboard, Events calendar, Marketing analytics) would read better, and directors could land on Board overview.
8. **The board's "read only" banner** does not match what directors can do (add board items, log touchpoints). Say what they can do.
9. **Names that clash:** Fundraising & Finances has both "Finance" and "Finances" tabs and "All tasks" where every other team says "Tasks"; the Board page tabs read "Board overview, Committees, Overview, Agenda, Tasks".
10. **Home:** the "open decisions" tile shows a flag where the others show a number; Your time off and Policies sit under the "New look" line outside any card; an empty "Slack notifications" card.
11. **Training academy** has no page title at the top, and the page tours appear twice (as rows and as library cards).
12. **Important info:** the add-a-link fields have no labels and their hints are cut ("Label, e.g. Canva tea").
13. **The Brain:** labels overlap, and every goal label starts with "Q4 FY2026:" and is then cut.
14. **Calendars:** event names cut to a few letters on the month grid and the year timeline.
15. **Consistency:** several button styles for the same kind of action, mixed heading styles, mixed date formats on one page ("2026-08-05", "Aug 5", "07/08/26", date pickers in mm/dd/yyyy), and lowercase sign-in names ("steel macdonald", "valex sanon") in What's new and the audit trail.

## Content to clean up (needs a person)

1. **Test accounts on the live roster:** "Info Test" (Operations Montreal) and "Steel Test" (Marketing), both active; info@welfareavenue.com is an admin. Remove them or mark them as test accounts.
2. **Tate** is active on the Toronto roster as Regional Director of Ontario and a Toronto lead, while the Toronto page's priorities mention his step-back on June 20. Confirm and update.
3. **Board titles disagree:** the roster says Steel is "Founder, Co-ED, Board President"; Board overview says "Vice chair", with Kellian as Chair. The org chart and the Board team page follow the roster.
4. **Access clean-up from wave127 still stands:** Natasha inactive but admin, 9 admins now, roberto.toto with access but not on the roster.
5. **Donations tile:** "$4,015 donations this fiscal year, from the ledger, since October 1" stops at June 30, where the statements end. Load July to September, or label it "to June 30".
6. **Transcript archive:** duplicates (the July 15 marketing meeting twice, one filed under "Marketing, Branding & Web" instead of the Marketing team so it may not show on its page; the May 13 branding conversation twice; the July 22 weekly operations meeting stored twice, once under HR), and meeting dates a day early against their titles (July 22 filed as July 21, June 30 as June 29).
7. **Department goals:** 14 of 28 are past their due date and still open (for example Complete Brand Refresh, due March 30; Website Redesign, due June 30, not started). Close them, re-date them or mark them delayed. 16 of 28 are not linked to an organizational goal.
8. **Spelling:** "accross" in two organizational goal titles; "Human ressources" in a meeting title.

## Left out (test artifacts, not real problems)

Placeholder tasks ("Task 90001"), project pages showing every task, empty Delivery numbers averages, an empty Activity list, "0 finished" on person pages, empty seasons on the Events calendar, recommendations cut mid-word, the "Rally Paper moves to October 18" and "Tate has left" announcements and placeholder committee purposes all came from the test snapshot; the live data has real titles, project links, close dates, activity, seasons and purposes, and no announcements. Blank thumbnails (network blocked), "Good evening" at 4 pm (the test's time zone) and "0 active" are also artifacts.
