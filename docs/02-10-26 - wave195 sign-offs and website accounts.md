# 02/10/26 - wave195: volunteer sign-offs, and the website accounts

Two asks from Steel on 02/10/26, built in one session. The website accounts were reserved as "wave194" (change_log 4489), but another session shipped the Hub's 194 (Updated since you finished and the certificate) the same day, so this note calls them the website accounts and the Hub segment is `195_wave195`.

- **The Hub:** live md5 `7f576e8ee27bb7344fef41296658ea54` (from `e07376da`), the segment inserted before WA v164 in part 10 by an md5-guarded patch, published by host-sync; `build/candidate.html` is the live build.
- **The website:** the launch build with the account page (`/account/`, `/fr/compte/`) and the privacy page (`/privacy/`, `/fr/confidentialite/`), deployed through `www_files` and www-sync. Accounts are switched off: `app_config.site_accounts_mode` is `off`, so the account page says it is coming soon.
- **The database:** `wa194_site_accounts` and `wa195_signoffs` (in `build/data`).
- **Functions:** `site-account` v1 (new; its source joins the repo with its next version), `signoff` v1 (new), `form-submit` v5 (platform version 10).

## What Steel asked

The accounts: "I want users to have the ability to sign up through google to capture important informaton when they sign up for forms (auto-fill). they should have their own profile too - I hope to have as many of our old account from the old website brought over to the new site so that they don't loose their accounts". His choices: sign in with Google or an emailed code or link, no passwords; the profile has their details, their volunteering record, their gifts and receipts, and their email preferences; old-site records connect when the person signs in with the same email, and nobody is emailed about it; what they type in a form is saved to their profile.

The sign-offs: "I'd also like to add my signature to volunteer recognition and volunteer hours sign off requests that volunteers can ask for on their profile in the website. This would appear on our volunteer manager as it's own page to sign off on hours completed with us." His choices: three requests (an hours sign-off letter, a letter of recognition, their own form signed); signers are the Operations leads, the admins and the people an admin assigns; the volunteer gets the PDF on their profile and an email.

Later the same evening he confirmed the line between the two: volunteers, donors and supporters sign in on welfareavenue.com; the Hub stays for the team and the board.

## What changed for people

**On welfareavenue.com (switched off until Steel's Google step is done):**

- **My account:** sign in with Google or a code we email. The profile shows their details (name, pronouns, phone, address, language), their volunteering (servings, hours, roles), their gifts and official receipts (PDFs through short links), the newsletter on or off, and their letters.
- **Letters:** ask for an hours sign-off letter, a letter of recognition, or their own school or employer form signed (a PDF upload). They follow the request, can withdraw it while it waits, and download the signed PDF, or read the team's note if it was declined.
- **Forms fill in** for a signed-in person, and what they type is saved back to their record.
- **Privacy notice** in English and French: what we keep, why, who processes it (Supabase, Netlify, Stripe, Resend, Quo, Google), no tracking cookies, the Commission d'accès à l'information du Québec.
- A team or board address is turned away on the website and pointed to the Hub.

**In the Hub (live):**

- **Volunteer Manager, Sign-offs** (`#volunteering/signoffs`, the rail item under People with the waiting count, a chip on phones): Waiting first, then Signed, Declined and All.
- **A request's sheet:** what they asked for and for whom, their record, the servings and hours to list (leave one out, change the hours), the signer's own words on a recognition letter, where the signature goes on their own form (page, spot, size, caption, our hours page after it), Preview, then Sign and send (the PDF on their profile and an email as `mail_mode` allows) or Decline with a note they read.
- **My signature:** drawn, uploaded (white paper is cleared), or for Steel the one he sent for the certificate; with the name and title printed under it, and a French title for French letters. A sample letter shows how it prints.
- **Signers:** who signs and why; admins add and remove people.
- **The page tour** "signoffs" (trainings row 230, Page tour: Sign-offs).
- Board viewers get none of it.

## The database

- `site_account_emails` (the sign-in codes the website was asked to send), `crm_contacts.pronouns`, `crm_form_submissions.auth_user_id`.
- `site_account_config`, `account_link_user`, `account_me`, `account_prefill`, `account_update`, `account_newsletter`, `site_account_stats`; `crm_form_apply` uses the account's own contact when a submission carries `auth_user_id`.
- `volunteer_signoffs` and `volunteer_signers`; the volunteer's functions `account_signoffs`, `account_signoff_request`, `account_signoff_cancel`; the team's `signoff_list`, `signoff_detail`, `signoff_decline`, `signoff_signer_me`, `signoff_signer_save`, `signoff_signers`, `signoff_signer_assign`, `signoff_counts`; the function's own (service role) `signoff_sign_data`, `signoff_mark_signed`, `signoff_mark_emailed`, `signoff_signature_set`.
- The email templates `signoff_ready` and `signoff_ready_fr` (transactional).
- Every new object has its COMMENT; `docs/DATA_MODEL.md` is regenerated.

## Tests

- `test/w194www.js` (87): the account page signed out, by code and by Google (stubbed GoTrue), the profile, volunteering, gifts, preferences, letters (ask, upload, withdraw, download, declined), forms filling in and saving, French, a phone, a team address turned away, the switch off and test.
- `test/w162www.js` (752): the whole website, with the account links hidden while accounts are off.
- `test/w195drive.js` (52): the Sign-offs page as a signer, a non-signer, a board viewer and on a phone, with the database and the signoff function faked in the page.
- The release gate against the live build: `w134drive` 34 of 34, `w176drive` 14 of 14, `w191drive` 39 of 39, `w192drive` 79 of 79, `w190drive` 25 of 25, `w153drive` the same two failures as live, every page tour (the new one highlights its three sections), and the page harness for staff, board and a member: the only difference is the Sign-offs chip in the Volunteer Manager (other differences also vary between two runs of the live build).
- The signoff function's `check` drew test letters live with the brand fonts and the lockup.

## Still to do

1. **Steel's Google step for the website:** a new Google Cloud project for the public site (External, In production, app name Welfare Avenue, home page welfareavenue.com, privacy policy welfareavenue.com/privacy/, scopes email and profile), a web OAuth client with `https://welfareavenue.com` and `https://www.welfareavenue.com` as JavaScript origins, its client ID added in Supabase (Authentication, Providers, Google, after the Hub's), then `app_config.site_google_client_id`, `site_accounts_mode` test, then on.
2. **At switch-on:** hub.welfareavenue.com/me redirects to welfareavenue.com/account/, and the confirm page's Save to my account (`ACCT_ON` in `build/c/src.html`) points there.
3. **Next (Steel, 02/10/26):** team and board members get a website account too, with the photo they already have in the Hub or Slack, ready for the website's team page later.
4. Steel saves his signature in Sign-offs, My signature, and reads the privacy notice.
5. The temporary stage tables are dropped once Steel confirms.
