# Wave 153: the apps (27/09/26)

Steel, wave149: "the app launcher (9-dot, bottom left: Admin centre, HR centre, Finance with the finances pages only, then the CRM)". Wave152: "remember the 9 dots for the Finances module, HR center module, and CRM module? ... the CRM will need space both at the top for menu and search options, as well as on the side for all the options like email marketing, fundraising, etc". Then: "Okay go for it step 1 first".

## What shipped

- **The dock and the launcher.** At the foot of the menu, a 9-dot button ("Apps") that stays in view however long the menu is. It opens the launcher: the Hub, the CRM, the HR centre, Finance and the Admin centre, each with a line on what it holds. Only the apps this person can open are offered (an app is there when one of its pages is in their menu); directors get no dock at all.
- **The app frame.** Inside an app the menu becomes the app's rail (its pages and sections, the current one marked, grouped) with "Back to the Hub" in the dock, and an app bar above the page names the app and where you are, with the app's quick actions (the CRM: Add a contact) and, on a phone, a Menu button that opens the rail in the drawer. Nothing was rebuilt: the rail and the bar are a frame around the pages that already exist.
  - **CRM** (teal): Contacts, Possible duplicates, Sources; Gifts; and a "Next in the CRM" note that keeps the room for Lists, Email, Forms and Reports. The CRM is always an app: any `#crm` address opens the frame, and its own tab strip steps aside on wide screens (the rail has it).
  - **HR centre** (red): People, Onboarding, Training, Recruitment, Commitment, Policies, Discipline (the page's own tabs, switched from the rail and followed when clicked on the page); then Human Resources, Org chart, Avenue Academy, and People and access for admins.
  - **Finance** (orange): the finances pages only: Overview, Trends, Money map, Budget, Transactions.
  - **Admin centre** (slate): the Admin sections (People and access, Access profiles, Security and audit trail, AI models, Adoption, Workspace accounts, Loading screen and news, Change the Hub) and Activity.
  - The apps other than the CRM open from the launcher, are remembered on the device (`localStorage` `wa153.app`, so a reload keeps you in the app), and close on their own when you open a page outside them. Back to the Hub returns to the page you left (`wa153.last`, else Home).
- **Search everything finds contacts** (staff with the CRM): a name (accents ignored), an email or a phone; first when you are in the CRM, where the box says "Search contacts". The contacts load on the first search.
- **The CRM's Gifts tab** (`#crm/gifts`): every gift newest first with the donor (a link to their page), the amount, campaign, platform and receipt; the totals (all time, this fiscal year to 30 September, donors, receipted), a search and filters by platform and fiscal year. Today: 56 gifts, $9,280.29 (Keela's export); Zeffy joins next.
- **Tour** `tour:apps` (six steps: the dock, the launcher, inside an app, the app bar, back to the Hub, what comes next) in Avenue Academy's Hub tours (sort 39).
- **A fix on the way:** the HR centre's People landing (116p) rewrote the address to `#hrcentre/people` when its render finished after you had already left the page (the rail made that easy to hit); it now lands only while the HR centre is on screen.

## The same evening: apps and Hub kept apart (153b)

Steel, on seeing the first cut: "all the pages that are shown on the apps now, they should just not be shown on the hub ... I also don't want you to combine things that are on the hub with things that are in the apps. They basically be separate."

- An app's pages leave the Hub's menu: the CRM (People), the HR centre (the Human Resources row), Finances (the Fundraising & Finances row) and the whole Admin group (its sections and Activity) are hidden by CSS; the buttons stay in the DOM because they carry the access rule (the launcher reads it) and the routing. The menu now reads Home, Executive dashboard, Calendar, Departments, Goals and projects, Meetings, Requests and inbox, People (Org chart, Avenue Academy), Resources; the dock underneath.
- An app holds its own pages only: the HR centre app is the HR centre's sections (read from the page's own tabs once drawn, since the People view depends on the person; a person who only gets the page's notice sees the page alone in the rail). Human Resources, Org chart, Avenue Academy and People and access went back to where they belong (the Hub and the Admin centre).
- Any address of an app's page opens that app (the page owns the app; no remembered app any more): a link to #hrcentre/policies opens the HR centre on Policies, #finances opens Finance, #adminpanel/security the Admin centre. A Hub page leaves the app. Back to the Hub returns to the last Hub page you were on (`wa153.last`), else Home.
- Deep links to a section the page cannot land on itself (the HR centre only handles onboarding, training and recruitment) are settled by the frame: it asks the page for the section until it is on, surviving the page's tab rebuild.
- A leader (no Admin page) reaches Activity through the Admin centre app, which shows Activity alone for them.
- Live md5 858d9f900edb95453b02eea510230db1. Tests: w153drive 44, w152drive 68, w134drive 37 (the layout test now expects the apps' pages out of the menu).

## Files

- `build/parts153/*.js` → `build/src/153_wave153.seg` (in MANIFEST after 152, before 110): `a_head.js` (the apps and their rail items, access), `b_css.js`, `c_frame.js` (dock, launcher, rail, app bar, open and close, the section switches), `d_search.js` (contacts in Search everything), `e_wire.js` (clicks, keys, hash and panel hooks, the tour, `window.w153` and `WA_APP`).
- `build/parts152/e_gifts.js` (the Gifts tab; the loader, state, tab and route in `a_head.js` and `c_list.js`).
- `build/src/116p_wave116p.seg`: the landing guard.
- `build/data/wa153_apps.sql` (run at deploy: the tour's training row, the release line in the change log).
- Tests: `test/w153drive.js` (41 checks: an admin through every app, the search, the gifts, the reload, the tour; a member on the HR profile; a director; a phone), `test/w152drive.js` (68, the fourth tab), `test/w134drive.js` (37, unchanged).
- Docs: `docs/ARCHITECTURE.md` (9. Navigation: the apps; the page map).

## Next

Step 2 of the plan: the email foundation (Resend from welfareavenue.com, the branded templates, the CASL footer and suppression), then the CRM toward Keela (lists and segments, campaigns with a send log, automations, donations with acknowledgments until RR0001 is confirmed), the forms, the new website. A small refinement for the next wave: rank contact search hits whose name matches ahead of email-only matches.
