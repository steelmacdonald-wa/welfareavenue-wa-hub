# 26/09/26 - wave146: the monthly security check

Live md5 `e6645074ddae90ba11c2df750d66d7d7` (4,060,546 bytes), deployed through the gated pipeline (`wa_stage_rs`, guarded on the live md5 `2a34a0b4` and dropped after). Data: migrations `wa146_security` (the table, admins only) and `wa146_security_cron` (the first of each month at 08:07 in Toronto, and the admin profile). Function: `security-check` v4 (new). Page: segment `146_wave146`.

## What Steel asked

"go for all the above": the Google projects the delegated access opened. This is the fourth, a monthly security check.

## What it reads

- **The Workspace directory**: every account, whether it has 2-step verification (and whether it is enforced), when it last signed in, which ones are admins, and whether the person is on the Hub roster.
- **The Drive**: the files anyone with the link can open. It searches what Steel's account can see (every shared drive and what is shared with him); other people's My Drives are not searched.
- **The Google audit logs** for the month before: Drive sharing with people outside Welfare Avenue and files made public, sign-ins (Google's warnings, failures and the sign-ins Google found unusual), the apps people connected to their account, and admin changes.

It changes nothing in Google. Each finding has a level (fix now, plan it, worth a look, for the record, good), what it means, the people or files concerned, what to do and a link to the right Admin console page.

## Where it shows

Admin, Security and audit trail: at the top of the card, the latest check (when it ran, how many to fix now and to plan, the date of the next), six headline numbers compared with the check before, the findings (click one for the detail, the list and what to do), the earlier checks, and **Run the check now** (about a minute). Admins only, in the page and in the database.

## The first check (26/09/26)

- **2-step verification**: 8 of 46 active accounts have it; enforcement is on for 6. All six admin accounts have it.
- **Unused accounts**: 9 active accounts have not signed in for 60 days or more (people who left the roster, shared inboxes, directors who sign in with a personal account, and a few accounts that are not on the roster).
- **Public files**: 758 files and 174 folders can be opened by anyone with the link (not counting 175 Google Forms, which are meant to be public). 65 have sensitive-looking names, among them the signed 2025 financial statements and the 2025-26 budget in Accounting, a board agenda in a director's My Drive, and items named Board and Human Resources in the Human Resources drive.
- **Sharing outside Welfare Avenue** in the last 30 days: 7 files (a partner agreement with the Toronto Youth Food Policy Council's people, for example); 9 files made public.
- **Sign-ins**: no warning from Google; 11 sign-ins Google found unusual and 7 failures.
- **Apps**: 17 connected, 3 with full access to Drive or Gmail, including an app named "Welfare Avenue Executive Dashboard" that holds admin, Drive and Gmail access for six people.

## How it works underneath

- `fn/security-check/index.ts`: `pages()` and `log()` page through the Directory, Drive and Reports APIs; `run()` builds the findings (accounts, public files, sharing, sign-ins, apps, admin changes), sorts them by level, keeps the headline counts in `summary` (with the app names, so the next check can say which apps are new) and writes one row to `security_checks` and a line to the change log. A source that fails is noted and the rest of the check still runs.
- `146_wave146.seg`: reads the last twelve checks, draws `#w146sec` after the heading of `#w86card`, and puts it back when the admin page repaints; a tour step after Security and audit.
- The cron calls it through `call_edge`, whose request gives up after ten seconds while the function carries on (checked: the run completes and writes its row).

## What the challenge changed

- The first run called twenty sign-ins "suspicious" and rated them fix now. They were ordinary sign-ins Google found unusual (a new device or place) and let through. Google's own warnings (suspicious sign-in, leaked password, government-backed attack) are now the only fix-now sign-in finding; unusual ones are listed per person to ask about.
- Gmail add-ons (which only see the message open in front of the person) were counted as full Gmail access. Full access now means the whole Drive or mailbox, or an admin scope.
- A partner agreement shared with the partner was rated plan it. Sharing outside is a list to look over; sensitive-looking names only raise it to worth a look.
- The Hub's own service account appeared in the admin changes as a number. It is named.

## Things to look at (not changed by the Hub)

- Turn on 2-step verification for everyone (announce a date, then enforce it in the Admin console): 38 accounts open the shared drives with a password alone.
- Restrict the sensitive-looking public files and the public folders, starting with Accounting and the Human Resources drive, and set new files to Restricted by default in the Drive sharing settings.
- Suspend the accounts of people who have left, after handing their files to their team.
- Check the app named "Welfare Avenue Executive Dashboard": if it is the Hub's old sign-in app, its admin and Gmail access is no longer needed.

## Release checklist

- **Access:** one new table, admins only; the admin profile says what the check covers.
- **Training:** the admin tour has a step for the check.
- **Security review:** read-only use of the delegated scopes already granted; findings (names, emails, file titles) stay with admins; nothing written to Google.
- **Tests:** `test/w146drive.js` (14 checks: its place, the headline and the next date, six numbers compared with an earlier check, the findings in order, a finding's detail and link, the earlier checks, Run the check now, the tour, other admin sections, a member, no page errors). The live-versus-candidate harness differs only on the admin panel (the block) and the known HR centre timing noise.
