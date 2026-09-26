# 26/09/26 - wave131: People and access in one place

Live md5 `43f95848da47770abd0f355fa6438318` (3,645,930 bytes), deployed through the gated pipeline (`wa_stage_ra`, guarded on the live md5 `46295a8b` and dropped after). No schema change and no edge function change.

## What Steel asked

"In the admin panel 'People and access' and 'access profiles' need to make more sense. Please review, I need setting up and managing profiles to be more seamless."

## What was confusing

Two admin sections for one job. A wide table where each person had a classic role (admin, leader, member, viewer) and an access profile side by side, with hand-picked pages behind a link. Inviting someone set a classic role; the profile was picked somewhere else. Access requests sat in a third card, under a heading about the classic roles table. The profile comparison lived in a box with its own scroll, so it looked like it stopped halfway.

## What it is now

One section, **Admin > People and access**, with three tabs. The role is never picked by hand: it follows the profile (a team profile is member, or leader with the Lead switch; Executive is leader; Board member is viewer; Admin is admin).

**People**
- **What needs doing** comes first, each line with the button that fixes it: access requests waiting, people with no profile (one click gives each their team's profile, and turns on the automatic profile for new people), profiles that name a different team from the roster, people on the roster not invited yet (invite them all at once, each with their team's profile), people with no email, people marked inactive who can still sign in, and more than five admins.
- **Everyone, by team**: each person's sign-in status (signed in and when, invited, not invited, no email) and their profile. Search, a team filter and status chips (signed in, invited, not invited, no email, no profile, removed).
- **A person's sheet** (click anyone): pick the profile (their team's comes first, marked "their team", with a Lead switch that says what a lead adds), see the pages it opens and what they gain or lose before saving, then save. Send the invitation again, copy a one-time sign-in link, add a missing email, invite someone not invited yet (with the profile), or remove them (asks first). Founders stay on Admin. Hand-picked pages are still one link away.

**Invite someone**: name, email, team and title; the team's profile is picked for you (change it or switch on Lead), and the Hub emails the invitation from hub@ and sends a Slack welcome when it can. **Invite a list**: paste it, pick the team, check each person's team and profile, invite them in one go. An admin's "Invite a team member" on a team page opens the same sheet with that team.

**Profiles**: the nine profiles as cards (pages, extra pages for leads, how many people). Open one to set each page to Everyone, Leads or Nobody, edit what it says, and see who has it (with the people it is suggested for). Pages a release added that no profile has decided yet come with a Decide button. Every profile compared, full height. The automatic profile for new people is a switch at the top. The old address (#adminpanel/access) opens this tab.

**Requests**: each request says what Grant will do before you press it: a page is added on top of the person's profile, the lead option turns on their team's Lead switch, Admin moves them to Admin. Free-text requests open the person's sheet, then Mark done. Decline, and the last 20 decided.

**The classic view** (the old table, the roles table and the old Access profiles page) is one link away at the bottom of People, and back.

Also: Request more access (on My page) now speaks in profiles ("Your access profile is HR & People"), offers only the pages you do not have, and "Lead access for my team" instead of "Leader role".

## Release checklist

- Access: no page added or removed, and nobody's access changes by the release. The section is admins only as before; every write is one admins could already make (hub_roles, hub_access_profiles, hub_access_settings, wa_access_requests, and hub-invite).
- Training: the Admin tour's People and access steps are rewritten for the new page (tabs, what needs doing, the people by team, invite, profiles); the "Page tour: Admin" lesson says people and access is one place.

## Verification

`test/w131drive.js` at 1366 (46 checks) and 390 (49): the section, tabs and counts, what needs doing, filters, search keeping the focus, the person sheet (profile, Lead, what changes, save and the audit trail, sign-in link, resend, remove, founders, invite with the profile, add an email), invite someone, invite a list, invite everyone not invited, give everyone without a profile their team's, a team page's invite, the profiles (pages, words, the automatic switch, the whole comparison), requests (grant a page on top of the profile, decline), the classic view and back, hand-picked pages, the tour. Drives for waves 127 (five cases, the old page through the classic view) and 130 (three cases) green; harness x3 against the live build unchanged; churn clean; the Admin tour walks all 12 steps.
