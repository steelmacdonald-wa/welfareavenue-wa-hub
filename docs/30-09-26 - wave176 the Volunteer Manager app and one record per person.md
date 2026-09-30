# 30/09/26 - wave176: the Volunteer Manager app, and one record per person with the CRM

Steel (30/09/26): "I'd like the MTL Volunteering to be it's own app now, it's big enough that it should be it's own app. I do want to make sure that changes in volunteer records are reflected in both the CRM and Volunteer Manager. I need to ensure that we don't have redundant data and that changes can reflect both areas."

His answers:
- **The app:** an app in the launcher, not a separate site.
- **What is shared:** everything about the person is one shared record across both apps: details, notes and tags.
- **Who edits:** both apps edit the same record.

## The app

**Volunteer Manager** (leaf green) sits in the 9-dot launcher between Strategy and the CRM.

- **The rail:**
  - Servings: Calendar (every serving opens inside the app), The SOP, Recipes, Inventory.
  - People: Volunteers.
- **The app bar** has Text volunteers.
- **Menus:** MTL volunteering is gone from the Hub menu and from the phone menu's department chips. Any #volunteering address opens the app, and a Hub page leaves it.
- **The page's chips** give way to the rail on a computer; phones keep them.

## One record

**Before:** the volunteer directory (volunteer_people) held the person, and a trigger copied it one way into the CRM. The CRM wrote both, so the same name, emails and phones existed twice.

**Now the CRM contact is the person:**
- **What the contact holds:** name, emails, phones, address, notes, tags, and the organization they gave (a new column).
- **`volunteer_profiles`** (the old table renamed, same ids, so every roster row, text, account and letter keeps its link) holds only what is about volunteering: roles, car, the review flag, the Quo contact, and when they applied and joined.
- **`volunteer_people` is now a live view** of the two. Every page, function and edge function that used it keeps working, reading and writing the one record through instead-of triggers:
  - An edit in the Volunteer Manager changes the CRM contact.
  - An edit in the CRM shows in the Volunteer Manager straight away.
  - A new volunteer who is already in the CRM (a donor, with the same email) joins their existing contact instead of getting a second one.
  - Deleting a volunteer removes the volunteering profile and leaves the person in the CRM.
- **Merging two volunteers** merges the person once. Roster rows, texts, history, accounts and letters move to the kept volunteer, the profiles combine, and the dropped contact is merged into the kept one (crm_merge_contacts, also allowed when a Volunteer Manager user without the CRM page merges).
- **Access:**
  - The view is staff only. Functions and the service role read it; anon has no access.
  - A signed-in account that is not on the team cannot write (checked in the trigger).
  - The database's advisor lists the view as "security definer". That is intentional: the view's own rule limits it to staff.
- **The move** (applied 30/09/26): every volunteer's details were brought into their contact. The volunteer record won on name and address; emails, phones and tags were combined; notes were joined when they differed. 443 volunteers and 443 profiles. Four volunteers with no name now show "(no name)", as the CRM already did.
- **The editors:**
  - The Volunteer Manager's editor says it is one record and links to the CRM contact.
  - The CRM no longer writes the volunteer record a second time when saving.

## Built

- **Database:** `wa176_one_record` (crm_contacts.organization; volunteer_profiles; the volunteer_people view and `wa176_vp_write`; `volunteer_merge` rewritten; `crm_merge_contacts` patched; `crm_sync_from_volunteer` dropped).
- **The Hub:** parts153 (the app, its icons, the hide rule, Text volunteers); 026 (the editor's note and link); 152 (no second write).

## Tests

- **In the database, rolled back:**
  - The view matches the old directory row for row.
  - An edit in each app shows in the other.
  - A donor who starts volunteering is linked; a brand-new person gets one contact.
  - A merge combines the person once.
  - The confirm page, the roster phone and the functions still work.
  - A board viewer cannot write.
- **Offline:**
  - `test/w176drive.js` (12).
  - w152 (68), w153 (44) and w163 (38), updated for the app and the single write.
  - The regression set is green.
