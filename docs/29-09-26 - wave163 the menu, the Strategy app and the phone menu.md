# 29/09/26 - wave163: the menu's new shape, the Strategy app, Partners in the CRM, a menu that stays still, and the phone menu

Steel (29/09/26), in order:

- "Add those 2, and ensure to distinguish, partner, collaborator, and sponsors. No need to link the sheet, that sheet should be obsolete" (the two organizations the Partner Relations 2025-2030 sheet had and the Hub did not).
- "Could you add the following pages to an App called strategy:" (Organizational goals, Department goals, Projects, Goal alignment). Asked about The Brain and The bank, he chose "Bank in Strategy, Brain in Hub"; his next message moved the bank to Other Tools instead.
- "Put Avenue Academy below Home".
- A section "Other Tools" (Important Info, The Task Bank (previously The bank), Agenda, Document Finder, Transcript Archive, Photo Library), "by the way remove trainings from" Important info; a section "Organization" (Org Chart, Our Story, Hub Inbox); "move partners to the CRM for now"; and "when the page loads the website keeps reordering the menu based on all the pushs and updates I've made. Could you please have that stop". Asked where Requests goes once Hub inbox leaves it, he chose Other Tools.
- "the mobile layout of the menu at the bottom needs some serious testing and redesign to make it more intuitive". Shown the test findings and two directions, he chose the new bar with a menu sheet.

## Partners, collaborators and sponsors (wa163_partner_types, then the page)

- `wa_partners.category` (partner, collaborator or sponsor, a check constraint; default partner), defined as the Avenue Academy lesson Our partners and how we work with them defines them: a partner works with us toward a shared goal over time (ideally with an MOU or a project agreement), a collaborator joins us for an event or an initiative without a formal agreement, a sponsor gives money or in-kind support and gets recognition. `relationship` keeps the finer detail (a funder or a donor organisation is a sponsor; a supplier or a venue can be any of the three).
- Backfill from `relationship`, then 16 organizations set by hand from what the sources say (RBC, the University of Ottawa, FlagPlus, Daniella's Delights, La Licorne de Feu, Dawson, McGill and Jet Nightclub as collaborators; Oberoi, Lauzon, East Coast Donair, the Centre NAHA and Westmount Florist as sponsors; TYFPC, the YMCA and Sustainable Youth as partners). The two from the sheet were added: GHD Group (collaborator, 2021 to 2024) and Food Factory (a venue that declined). 145 organizations: 55 partners, 42 collaborators, 48 sponsors.
- The sheet is obsolete: its Academy training (138) is off, the Drive summary of the sheet says the Partners page replaced it, lesson 52 points to the Partners page, and `wa_story_context` (Ask the Hub) gives each partner's type.
- The page (wave140): Everyone, Partners, Collaborators and Sponsors above the list (each counted within the status shown, with what the type means under it); every card and sheet names the type first, then the detail when it adds one (Sponsor, Funder); the edit form has a Type (a funder or a donor organization must be a sponsor); search finds a type by name; the page tour has a stop for the types. Older rows without a category read theirs from `relationship`.

## The menu

- Top: Home, Avenue Academy, the Executive dashboard, the Calendar, then The Brain (the Events calendar sits between the Calendar and The Brain for people who cannot open the Fundraising team page).
- Departments as before.
- Other Tools: Important info, The Task Bank, Agendas, the Document finder, the Transcript archive, the Photo library, Requests. A page the layout does not name lands here (it was Resources).
- Organization: the Org chart, Our story, the Hub inbox.
- Goals and projects, Meetings, Requests and inbox, People and Resources are gone. The crumbs, the access profile editor's groups (`parts127`, `parts131`: Everyday, Departments, Board, Other Tools, Organization, Strategy, CRM, Admin), the chrome tour's menu step and Hub modules 1, 2 and 5 follow.
- The Task Bank is the bank's new name (the menu, the page title and tab title, the sheet, the search box, its tour and training 93). Buttons such as Move to the bank keep their words.
- Important info no longer shows Training videos (the full library is the Avenue Academy), nor offers Training video in its add form. Two rows had that kind: DocuSign training is in the Academy (training 105); the ED onboarding walkthrough (from Suhaib's onboarding) is not, and stays in `info_links` unshown until Steel says where it goes and for whom.

## The Strategy app and Partners in the CRM (wave153)

- Strategy (purple, a target): Goals and projects: Organizational goals, Department goals, Projects, Goal alignment. A project's own page (`#project/<id>`) opens inside Strategy with Projects marked. In the launcher after the Hub.
- The CRM's rail: Contacts, then Partners, then Possible duplicates and the rest. Add a contact shows on the contacts page only.
- Directors open no apps, so Partners stays in their menu, in Organization (`html.w163dir`), with Organization as its crumb.
- The app bar's icon tile no longer carried the breadcrumb arrow (it read "›" and a faded icon in every app).

## The menu stays still while the Hub starts

What was happening: every wave that shapes the menu (the roles, the access profiles, the team rows, the layout, the apps) runs after its own data arrives, one after another inside `startApp`. The loading screen lifts when that chain ends, or after 9 seconds at the latest. Measured with every request slowed to 450 ms, the chain took about 13 seconds, so the page showed at 9.5 seconds and the menu was then rebuilt 15 times in front of the reader over 3 more seconds (My page became Home, Open Decisions became Decisions then Dashboard then Executive dashboard, Work and Records became the current groups, the teams filled in one by one, the Calendar arrived).

Now `163_wave163` keeps the menu out of sight until the chain has run, applies the layout one last time, waits until the menu has been still for a moment (140 ms, at most 2.5 seconds) and shows it once; wave110 waits for that (at most 1.5 seconds) before lifting the loading screen, so on a normal load the page appears whole. If the Hub never finishes starting, the menu shows after 20 seconds anyway. Measured: at 250 ms per request the menu shows at 8.2 s and the page at 8.3 s; at 450 ms the page shows at 9.5 s without a menu and the menu at 12.4 s; nothing in the menu moves after it shows (`w163.state().after`, 0 for every identity and on a slow load).

## The phone menu (wave163b)

Tested first (390 x 844, the admin, a member, a director): Ask sat in the middle as the striped E in a gold circle and read as a menu button; Teams and More both opened the same long drawer (every page in one scroll, no close button at the top, no way to find a page); the apps sat at the very bottom of that drawer; only Home and Dashboard ever lit up; inside an app the bar still offered the Hub's buttons while the app's menu hid behind a second Menu button; and Ask the Hub opened full screen under the bar, which covered its message box (on the live page too).

Now, up to 900 px wide:

- The bar: Home, Calendar, Ask (a chat bubble in the gold circle), My team, Menu. The button for where you are lights up (Menu for any page not in the bar, apps included). My team opens your roster department's page (Steel: Board & Governance; a member of HR: Human Resources); without one it opens the sheet at Departments. Directors: Dashboard, Calendar, Board (the Board overview), Menu.
- Menu opens a full-screen sheet: Find a page at the top (it finds the Hub's pages, each team's own pages and every app page you can open; Enter opens the first), the apps as tiles (the one you are in ringed), then Home, Avenue Academy, the Executive dashboard, the Calendar and The Brain, Departments (each team with its own pages as chips, yours marked Your team), Other Tools and Organization, the page you are on lit. Inside an app the sheet is that app's menu, with Back to the Hub. It is drawn from the menu each time it opens, so it always has what your access opens, in the menu's order.
- The bar steps aside while you type, while the sheet is open and while Ask the Hub is open. The app bar's own Menu button is gone on phones.
- The chrome tour's menu step shows the bar on a phone; Hub module 1 describes both.

## Releases

- wave163: `1a86a2c1d5dd20181890526481f43542` to `9feedd1dd3d2b0dd14ae046fabf4c930` (4,625,064 bytes). wave163b: to `6aca2aa3e9aaee3328098dedccab65a6` (4,653,761 bytes). Both through the gated deploy, host-sync and a byte-for-byte check of the hosted copy; the stage tables were dropped.
- Migrations: `wa163_partner_types` (20260929033000), `wa163b_menu_training` (20260929050000: Hub modules 1, 2 and 5, tours 78, 93, 200 and 205, lessons 52 and 198, the release row), `wa163c_phone_menu` (20260929060000: Hub module 1, the release row).

## Files

- `build/parts163/` (new, `163_wave163.seg`, in MANIFEST before `110_wave110`): `a_head.js`, `b_gate.js` (the menu gate), `c_phone.js` (the bar and the sheet), `z_wire.js` (`window.w163`).
- `build/parts134/` (the layout, directors' Partners, Important info), `build/parts153/` (Strategy, Partners in the CRM, icons, the hide rule, the app bar tile, `WA_APP.order`, `icon`, `isOn`, `owner`, `go`), `build/parts140/` (the types), `build/parts127/`, `build/parts131/` (the editor's groups), `build/parts132/` (The Task Bank), `build/parts152/` (the CRM's crumb), `build/src/110_wave110.seg` (waits for the menu; The Task Bank), `116d`, `116f`, `116h`, `118`, `118c` (crumbs), `122` (the chrome tour, Important info's tour).
- `build/data/wa163_partner_types.sql`, `wa163b_menu_training.sql`, `wa163c_phone_menu.sql` (each with its `.rec.sql`).
- Tests: `test/w163drive.js` (38: the menu shows once for three identities and on a slow load, the phone bar and sheet for an admin, a member on a 360 px screen and a director, Find a page, My team, a chip, the CRM's menu, Back to the Hub, the Strategy tile, Esc, Ask the Hub); `test/stub_supabase.js` takes `window.__WA_LAT` to slow every request for load-order tests; updated `w130`, `w132`, `w134`, `w140` (59, the types), `w152`, `w153`, `w155`, `w156`, `w157`, `w160`. Every drive test from w130 to w163, and w118cphone, passes (949 checks in 32 files), the page tours complete and the churn probe is zero. One w149 check (a bar's hover numbers in Analytics) fails now and then on the live build too; it is not this wave.
- `parts122` and `parts129` are stale (their segments were edited directly later): edit `122_wave122.seg` and `129_wave129.seg`, not those folders.
