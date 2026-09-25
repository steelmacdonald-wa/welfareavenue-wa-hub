# 25/09/26 - wave127 access profiles: what each role gives access to

Live md5 `b81eb2771df808a516329de87a23ba53` (3,386,864 bytes), deployed through the gated pipeline (`wa_stage_qv`, guard on live `0ca52b11`, dropped after). Migrations `wa127_access` and `wa127_access_board_auto`; Hub module 9 is training 92.

## What Steel asked

"Make a role for a marketing team member, a fundraising team member, an operational team member, like program development, operations Montreal, Toronto, a board member access profile, and as well as an executive and admin access profile. It's really important that you make it very clear in that page what each role provides access to." And the standing rule: review the security roles and the Hub training whenever the Hub changes.

## The nine profiles

Marketing, Fundraising & Finances, Program Development, Operations Montreal, Operations Toronto, HR & People (added: the HR team needs one too), Board member, Executive and Admin (`hub_access_profiles`). Each page is open to everyone with the profile, to its leads only, or to nobody. A team profile has a lead option (`hub_roles.role = leader`).

- Every team profile: Home, Calendar, Requests, the Executive dashboard and delivery numbers, Create studio, Photo library, The Brain, Important info, the goals and projects pages, every team's page (the Hub stays open between teams), MTL volunteering, the Events calendar, the transcripts, the Org chart and the academy.
- Team tools: Marketing gets the Content calendar and Analytics; Fundraising & Finances gets Finances and Analytics; HR & People gets the HR centre.
- The lead option adds Agendas, Activity, the HR centre, the Content calendar and Analytics, the board pages and Committees. Finances stays with Fundraising & Finances, Executive and Admin; the Hub inbox with Executive and Admin.
- Board member: the Executive dashboard, Calendar, Events calendar, Photo library, Analytics, Content calendar, Board overview and Committees (what board viewers already had).
- Executive: every page except Admin. Admin: everything.

## The page (Admin > Access profiles, `#adminpanel/access`)

- How it works in three lines, and where it stands (who is on a profile, the proposal count, "New people get their team's profile automatically").
- A card per profile: who it is for, what it lets you do, its page count and what leads add, what it leaves out, who has it. "Every page" opens the full list with what the database adds; admins can edit the words.
- Every page, profile by profile: a table of every page against the nine profiles. Admins click a cell to change it (everyone, leads, nobody); changes save for everyone at once. A lock marks what the database enforces too.
- New pages to review: any page a release adds that no profile decides yet is listed at the top; until someone decides, it follows its built-in gate.
- Who gets what: the proposal (each person's team from the roster, the lead option for today's leaders, Admin for today's admins, Board member for directors not on staff), with what each person would gain and lose, Apply per person or for everyone.
- Worth a look: people inactive on the roster who still have access, access without a roster row, how many admins there are, lead titles without the lead option.
- Always true, whatever the profile: HR records with the HR access list, private and leadership transcripts, agendas, confidential board items, your own things, and hand-picked pages.

Also: People and access picks a profile in the Access column (or a classic role); Your access in the profile menu shows anyone their profile, pages and what they can do, with Request more access; the Admin tour stops at the new section; Hub module 9 ("who sees what") joins Using the Hub.

## What the database enforces

- `wa_page_ok(page)` answers with the same rules as the menu. The finance tables (transactions, budgets, statements) now require it for people on a profile; `can_see_board()` and the board write policies follow it for leaders (directors always see the board). People without a profile, or with hand-picked pages, keep today's rules: nothing changes for anyone until they get a profile.
- Two holes closed: signing in for the first time could create your own access row with any pages or profile (now it must be a plain member row), and anyone on staff could add themselves to the board viewers list, which opened the board data and leadership transcripts (now admins only).
- With a profile, the HR centre follows the profile instead of the old hard-coded list; HR records stay with the HR access list in the database.
- New people get their team's profile when "New people get their team's profile automatically" is on (a trigger on `hub_roles` and `team_members`); directors on the roster get Board member.

## Fixed on the way

- Board viewers' menu: the Departments rows with no page left lone chevrons, and their Analytics and Content calendar sat in a collapsed row; now they show as plain items. The same close-up applies to anyone whose profile hides a team row.
- The donations tile on the dashboard hides for people whose profile closes the ledger.

## Verification

`test/w127drive.js`: admin 32 checks (the section, cards, table edit and undo and save, the profile sheet, the edit form, the proposal and apply, People and access, the tour, Your access), a Toronto member on a profile 9, a Marketing lead 6, a board viewer 3, no profile 4, phone width 31 and 9. RLS checked with simulated JWTs in rolled-back transactions (a member on Marketing reads no ledger, on Fundraising reads it; a Marketing lead loses the board when the board pages are off for leads; self-enrolment with pages or a profile refused; a board viewer insert refused; the auto profile for a new Marketing member and for Kellian). Harness 36 pages x3 against the live build: only the Admin page, the menu fixes and known noise. Churn zero, including profiled users. Tours: the Admin tour 9/9; academy 35/35; the board, calendar and SOP drives green.

## For Steel

- Nobody has been switched yet: admins count as the Admin profile, everyone else keeps today's access. Check the proposal on the page, then Apply.
- If you apply as proposed: Kahkashan, Shima and Ahmed (leads) lose Finances and the Hub inbox and gain Agendas; fundraising members gain Finances; HR members gain the HR centre; Operations and Program Development members lose Analytics and the Content calendar (the calendar still shows the posts); Kellian and Tamara become Board member when they first sign in.
- Worth a look: Natasha is inactive on the roster but still an admin; Roberto Toto has access without a roster row; 8 people are admins (Eduardo, Ian, Tuna, Valex and the Info test account beyond you, Suhaib and your Gmail); Eno, Melvina, Tate and Zachee have lead titles but are members today.
- The HR access list differs between the page's old hard-coded list (includes Tuna) and the database (includes your Gmail, not Tuna). Profiles now drive the HR centre page; the records follow the database list.
- Not changed: any staff account can still change the Hub's shared settings (`hub_settings`, such as the team inbox channels). Low risk; it can be locked to leaders if you want.
