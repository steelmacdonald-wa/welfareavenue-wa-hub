# 09/10/26 - wave220: team phone numbers on the Hub profile, the CRM and the Volunteer Manager

Steel (09/10/26): "Phone numbers of my team - please add them to their profiles (volunteer, crm, and hub profiles). The same goes for new onboardees." He gave seven numbers (Valex, Ian, Soraya, Joy, Amanda, Jemeela, Ahmed). Asked, he chose to merge each person's duplicate records into one, and a full Hub release for the profile.

## One record per person

Since wave176 the CRM contact is the person and the Volunteer Manager reads it, so a phone on the contact shows in both. A team member's contact is the one with `crm_contacts.member_id` = their roster id.

Found: six of the seven had two records (Amanda three): the staff contact made from the roster on 27/09 (WA email, no phone) and an older personal one (Gmail or other, often with the phone, the servings and the texts).

## The seven (migration wa220_team_phones)

- Each personal record was merged into the staff one with `crm_merge_contacts` (as Steel): servings, texts, history, both emails and tags kept; the volunteer record moved with it.
- The full name restored (Ahmed Fakhir, Amanda Bujalski-Zoldak, Ian Odhiambo, Jemeela Taing, Novie Joy Dumansi, Soraya Tyree, Valex Sanon).
- The number Steel gave is the main one (first in `phones`); the same number in another format was dropped.
- Amanda had no volunteer record (a Keela volunteer the directory never got): she has one now (roles server).
- The two contacts with only a first name and no email ("Soraya", "Valex", from the June confirmations grid) were taken as the same people.
- The numbers are not kept in the repo copy of the migration.

## New team members (migration wa220_member_contact)

- `hub_candidates.member_id`: the roster row a hired applicant became.
- `wa220_member_contact(member, volunteer)`: links or creates the team member's contact; merges the same person's other records (the roster email, the hired applicant's email, or the applicant's phone with the same first name; never another team member's contact); carries the hire's phone and personal email; restores the full name; with `volunteer`, gives an active non-board member a volunteer record (every member serves four times a year).
- `wa220_cand_for(member)`: the hired applicant behind a team member (the linked one, else the only hired, unlinked applicant whose name matches the roster name or the WA email).
- Triggers: `trg_wa220_member_contact` (team_members: added, email or name changed, back on the team; a new member also gets a volunteer record) and `trg_wa220_cand_contact` (hub_candidates: hired, linked, phone or email changed). A failure is a warning, never a failed save.
- Backfill (migration wa220_backfill_new_hires): Alyx (hired 25/09: her application's phone and Gmail, a volunteer record) and Roberto (added 02/10 with no contact: joined to his existing volunteer record).

## The Hub profile (build/src/220_wave220.seg)

- A person's page (#person/<id>): the main number after the email, with Call (tel:) and Text (sms:), and "+n more in the CRM" when the contact has other numbers.
- Edit / Add a phone number: the person themselves, HR, leaders and admins. Enter saves, Escape cancels; the page checks it looks like a number, the database checks again.
- `wa220_member_phone(member)`: the phones and can_edit; staff only, board viewers and blocked accounts get no row.
- `wa220_set_member_phone(member, phone)`: replaces the main number and keeps the others; empty removes it; change_log says it changed, not the number.
- The page tour's "Who they are: Name, role, team and contact." already covers it.

## Tests

- In the database, rolled back: a new hire whose old volunteer record has the same phone is joined to it (staff kind, emails, phone, volunteer record, applicant linked); HR can edit; a member edits their own and not someone else's; a non-number is refused; a board viewer and a Gmail account read nothing; anon cannot run either function, nor the internal ones.
- `test/w220drive.js` 21 checks (show, Call and Text, Edit, refusal, save with Enter, Escape, a redraw, Add, no Edit when not allowed, +1 more, nothing for no row, board viewer, phone width with no sideways scroll, no page errors). Regression on the build: w213 21, w219 82.
- The sources rebuilt the live build exactly (46e503b2) before the change.

## Notes for the next session

- An `update ... from (select ... limit 60)` that calls `wa_tmp_call_edge_long` in its SET fired 680 repo-sync requests instead of 60 (the subquery was re-run per row). Issue pg_net calls from a plpgsql loop over a fixed list. The database held.
- Other team members may still have two records (the 27/09 roster contacts against older volunteer records). The CRM's Possible duplicates lists them; `wa220_member_contact` does it for one person when they change.
