# 29/09/26 - wave164: Finance on its own, apart from Fundraising

Steel (29/09/26), in order:

- "Also for the Hub Inbox, all finance related emails like invoices, receipts, reimbursements should go straight to the finance slack channel not fundraising".
- On a screenshot of the Finance app's Trends page (the crumb read Fundraising & Finances, the title Finances and budgeting, and a tab strip repeated the rail): "It's a little repetitive here and still shows fundraising and finance being togther. these should be seperate".
- "accounting-finance is the private channel", then "I invited to accounting-finance" (the Hub's Slack app, @wa_hub, is a member since then; the Hub can only post in a private channel it has been added to).

## Fundraising and Finance are separate

- The team is **Fundraising** everywhere: the menu, its page, Requests, the access profile, the Hub inbox, the transcript upload and archive, the org chart, the Loom card, Meet attendance, the tours and the Avenue Academy, the edge functions' labels (ask, build-agenda, daily-alerts, hub-reel, process-leadership, process-transcript, project-slack, slack-command, slack-digest, weekly-digest, mail-pull, team-inbox). Its sub-teams are Grants, Event fundraising and Donor relations; the Finance board and the Finances tool link left its page.
- **Finance** is a code of its own, `finance` (label Finance, its own gold, #B9851B), with no team page, like the executive team. Its work lives in the Finance app: its board (Tasks), its team inbox (requests and emails) and its meetings. `#team/finance` opens the Finance app's Tasks.
- A meeting tagged Finance (the transcript upload's Finance option) files its tasks and updates under Finance (`txDeptKey`, `process-transcript` v16, `apply_transcript_result`); it used to go to Fundraising. The calendar no longer counts a "finance meeting" as a Fundraising one.
- Ask the Hub can file a request or a task to Finance; leadership meetings can give Finance its items (`process-leadership`).
- Access did not change: the Fundraising profile still opens the Finance app (its words now name the app), the executive and admin profiles too. Whether Fundraising members should keep the Finance app, and whether the treasurer should get it, is Steel's call.

## The Finance app

- Its own colour (gold, not Fundraising's orange) in the launcher, the rail, the app bar and the phone sheet.
- The rail: Overview, Tasks, Trends, Money map, Budget, Transactions, with no FINANCES heading repeating the app's name.
- On a computer the page's own tab strip is gone (the rail is the menu; phones keep the tabs, where the rail is not on screen). Inside any app the page's crumb is hidden, since the app bar says the app and where you are.
- The title follows the section: Finance on the Overview ("The year so far: what came in, what went out, how healthy the numbers are, and the finance work in flight."), then Tasks, Trends, Money map, Budget and Transactions, each with a line saying what it holds; the tab title too (Trends · Finance).
- **Tasks**: Finance's own board (the task board every team has, for `finance`): bills to pay, receipts to file, reimbursements to approve. The Hub inbox's money emails land there under Bills and receipts. The time frame is hidden there (it does not apply to tasks).
- **The Overview** shows Finance's team inbox after the numbers: requests to Finance and the emails the Hub inbox filed for Finance, "+ Ask Finance for something", and where they post (#accounting-finance). The fold under it now lists the money work on other teams' boards (receipts, payments, budgets, reimbursements), without grants and donors, which are Fundraising's.
- The year-over-year chart on Trends no longer fails when Trends is opened twice ("Canvas is already in use", on the live build too).
- The HR centre got the same treatment: no heading repeating its name, no tab strip on a computer (the People count moved into the rail), no crumb.

## Money goes to Finance and #accounting-finance

- **The Hub inbox** (`mail-pull` v9): every money email (an invoice, a bill, a receipt, a payment notice or a failed payment, a reimbursement, a bank, card or tax notice, a statement) is filed as a task on Finance's board, titled Receipt:, Reimbursement:, Payment problem: or Invoice:, never under Fundraising. Refiling an email as a money email files it under Finance. A dry run on a fundraiser's reimbursement email: invoice, finance, "Finance team handles reimbursements; Amanda is fundraising but this is a finance matter" (Jev agreed, 86%).
- **Slack** (`team-inbox` v1.2): Finance's channel is #accounting-finance, and every money email is posted there (`email_mode.finance = 'always'`: Steel asked for all of them, not only the ones Jev thinks need action; Requests, Slack settings can set it back to Jev's call). A money email says what it is ("Receipt for Finance", "Payment problem for Finance"). The channel check: `#accounting-finance` resolves for the Hub's app.
- **Requests**: Reimbursement request and Purchase order request go to Finance (they post in #accounting-finance). New request shows Finance as a team (Reimbursements, purchase approvals, invoices and receipts); Fundraising keeps grant information, donors, sponsors and events. Finance's team inbox follows the Finance app's access.
- **What moved**: the three money emails the Hub inbox had filed under Fundraising (Atlassian's declined Loom payment, the Quo and Netlify receipts) and their tasks, and the one purchase order request. Their notify records moved with them, so nothing was posted again (the Atlassian one was posted in #fundraising this morning, before the change).

## Releases

- The page: `6aca2aa3e9aaee3328098dedccab65a6` to `2146ee67b705fac75753e30d48da5fb5` (4,669,313 bytes), through the gated deploy, host-sync and a byte-for-byte check of the hosted copy; the stage tables were dropped.
- Functions: team-inbox v10 (v1.2), mail-pull v18 (v9), process-transcript v23 (v16), ask v22, process-leadership v14, build-agenda v17, daily-alerts v11, hub-reel v17, project-slack v16, slack-command v11, slack-digest v11, weekly-digest v11.
- Migrations: `wa164_finance_own` (20260929070000: the team's name and calendar, the profile's words, the tasks, the emails, the request types, Finance's channel and email mode, `apply_transcript_result` and `bank_add_task` learn `finance`, Hub modules 4 and 9 and the Finance tour, the release row), `wa164b_finance_comments` (20260929071000: the schema comments on the four department columns).

## Files

- `build/parts164/` (new, `164_wave164.seg`, in MANIFEST before `163_wave163`): `a_head.js`, `b_fin.js` (the section titles, Tasks, Finance's team inbox), `z_wire.js` (`window.w164`).
- `build/src/001_wave116a.seg` (the registry: Fundraising, `finance`, `WA_TEAMS.inbox`), `000_head_base.seg` (labels, `txDeptKey`, the transcript selects), `022`, `024` (no Fundraising link to Finance), `038`, `042`, `043`, `060`, `061`, `072`, `085`, `110`, `144`, `162` (labels), `093` (the fold and the Finance meeting tag), `094` (the Tasks section, `wa94show`, the chart fix), `116` (the Fundraising page, `#team/finance`), `116h` (the Hub inbox page), `118` (the masthead), `122` (the Finance and HR centre tours).
- Parts: `parts123` (Requests: `INBOX`, Finance's blurb, icon and channel, `w123.cardHtml`), `parts124`, `parts127`, `parts130`, `parts131`, `parts140` (labels), `parts153` (the Finance app, `solo` groups, counts in the rail, the hidden tab strips and crumbs), `parts163/c_phone.js` (the phone sheet follows).
- `fn/`: `mail-pull`, `team-inbox`, `process-transcript`, `ask`, `process-leadership`, `build-agenda`, `daily-alerts`, `hub-reel`, `project-slack`, `slack-command`, `slack-digest`, `weekly-digest`.
- `build/data/wa164_finance_own.sql`, `wa164b_finance_comments.sql` (each with its `.rec.sql`).
- Tests: `test/w164drive.js` (31: the Finance app on a computer and a phone, Tasks, the team inbox, the fold, `#team/finance`, the Fundraising page and menu, the transcript selects and mappers, Requests for a member, the HR centre, the Hub inbox); updated `w131`, `w132`, `w133`, `w153`. Every drive test from w130 to w164, and w118cphone, passes, except two checks that fail on the live build too: w149's hover numbers (now and then) and w131's "the old Access profiles address" masthead (it reads Access profiles).
- Left for the Loom wave: `loom-pull` still files a Loom recording about the budget or the books under Fundraising, and `loom_file` does not know `finance` yet.
