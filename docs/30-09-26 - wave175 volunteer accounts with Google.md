# 30/09/26 - wave175: volunteer accounts with Google (hub.welfareavenue.com/me)

Steel (30/09/26): "volunteers should be able to sign in with their Google accounts because we'd want them to be able to remember their accounts and the amount of times they've volunteered."

His answers:

- **Where:** a page of their own, not the staff Hub.
- **Linking:** the account links by the Google email when it matches their volunteer record, and otherwise from their personal text link.
- **What it shows:** their servings and hours, their upcoming servings, signing up for open spots, and a letter of their hours.
- **Text links:** they keep working without signing in.

## What volunteers get

At **hub.welfareavenue.com/me**, a volunteer signs in with Google and sees:

- **Their record:** how many servings they have come to, their hours (from the roster's hours, 2 hours by default), the year they started, their next milestone (1, 5, 10, 25, 50, 100 and on), and their roles.
- **Coming up:** each upcoming serving, with its status, their start time and their link.
- **Open spots:** upcoming servings in the next 90 days, for the roles volunteers can take themselves (server, cook, dishwasher, photographer, community welcome), while a role is under the roster board's target. Signing up adds them to the roster (TBD). The usual texts follow: the sign-up notice, then the confirmation 7 days before.
- **Where they've been:** their past servings, with the survey link for the last 14 days, or "Survey answered".
- **Letter of their hours:** a printable letter (print or save as PDF), in English or French, with the Welfare Avenue letterhead, their servings, hours, dates and roles, and a reference (WA-VH-xxxxxx) that staff can check.

On their confirm page, "Save to my account" goes to /me/?link=<token>. After they sign in, that personal link ties the account to their record. This works even when their Google email isn't the one we have on file.

## Safety

Every policy in the database treats a signed-in account as someone on the team or the board. A volunteer's Google account must never be that.

- **`wa175_access_token_hook`:** anyone who isn't team or board gets the role `anon` in their token, plus `wa_volunteer`. They can do only what the public confirm page does, plus the `volunteer_me` functions, which read their own verified sign-in. Team means a Welfare Avenue email, or hub_roles admin, leader, member or viewer. Board means board_viewers, board_circle, or active board members.
- **If the hook is off:** the page refuses and signs the volunteer out, and the functions return `hook: false`.
- **Their own page:** sessions are kept under their own storage key, so a volunteer never touches the staff Hub.
- **Email linking:** it happens only when the sign-in is Google's (a verified email) and exactly one volunteer record has that email.
- **Linking from a text link:** a link that belongs to someone else is refused.
- **Tighter reads:** three reads that were open to any signed-in account now need team (or board) access: `wa_policies`, `wa_hr_access` and `academy_assignments`.

## For Steel to switch on (in this order)

1. **Supabase dashboard → Authentication → Hooks → Customize Access Token (JWT) Claims hook:** choose Postgres, schema `public`, function `wa175_access_token_hook`, and enable it. Team sign-ins keep working as before.
2. **Google Cloud Console → the OAuth consent screen of the client the Hub uses (939437859037-…):** if it is set to Internal (Welfare Avenue accounts only), switch it to External, so volunteers' Gmail accounts can sign in. The scopes stay email and profile, so no Google review is needed.

Until both are done, /me says volunteer accounts aren't open yet. Test it with your own Gmail account.

## What the team sees

- **Roster cards:** "Signed up on their page" and "Has a volunteer account".
- **Text settings → Volunteer accounts:**
  - How many accounts are linked.
  - The roles volunteers can sign up for, and how far ahead (admins).
  - Checking an hours letter's reference.

## Built

- **Database:** `wa175_accounts`:
  - The tables `volunteer_accounts` and `volunteer_hour_letters` (staff read).
  - app_config `vol_role_targets`, `vol_signup_roles`, `vol_signup_days` and `vol_default_hours`.
  - `wa175_access_token_hook`, the helpers, and the volunteer functions: `volunteer_me`, `volunteer_me_link`, `volunteer_me_signup` and `volunteer_me_letter`.
  - The three tightened policies.
- **The page:** `build/me` (src.html and make.py, which takes the confirm page's styles). Google sign-in uses the Supabase code flow with PKCE, with no library.
- **Site files:**
  - `me/index.html`.
  - `_redirects` gains `/me` and `/me/*`.
  - `_headers` gains the strict policy for `/me`.
  - host-sync v9 (platform 16) publishes `me/index.html`.
- **The confirm page:** "Save to my account".
- **The Hub:** `build/parts171/g_w175.js`.

## Tests

- **Offline:**
  - `test/w175page.js` (34: the sign-in hand-off with PKCE, the code exchange, the account, signing up, the letter, linking, not linked, the hook off, signing out, refreshing an expired session, French, the phone).
  - `test/w175drive.js` (7).
  - w173 and w174 page and drive tests, plus the regression set, all pass.
- **In the database (rolled back):**
  - The hook: a Gmail account becomes anon, a Welfare Avenue one stays authenticated.
  - A simulated Google volunteer is linked by email: 25 servings, 50 hours.
  - Open spots, signing up, a wrong role refused, signing up twice refused, the letter recorded.
  - Linking from a link, and another volunteer's link refused.
  - Nobody signed in gets nothing.
- **Live:** /me/ shows the sign-in, and the button goes through Supabase to Google's sign-in page.
