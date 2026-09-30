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

## Full test and refresh (30/09/26, later)

Steel: "really take your time to test it through please and have a full refresh of it".

### What was tested

- **Every drive test (72 files), on the new build and on the build before wave176.** The only differences are the tests updated for wave176 (w152, w153, w163, w176), which now pass. The 28 older files that fail do so the same way on both builds (tests that fell behind earlier waves, not this change).
- **The live database (read only, and rolled back):**
  - 443 volunteer profiles, 443 rows in the view, none without a contact, none with two, none linked to a merged contact.
  - 1,016 roster rows, none pointing at a missing person.
  - The functions that read volunteers run: the roster phone, the confirm page and its details, an incoming text, the CRM report (2025-26: 69 new volunteers), a merge.
  - An edit in the Volunteer Manager shows in the CRM, and the other way round; deleting a volunteer keeps their contact.
  - Access: nobody signed out, and no volunteer account, can read the view, the profiles or the contacts; a signed-in account that isn't team sees no rows.
- **Live, in the browser, after a hard refresh:** the launcher, every page of the Volunteer Manager, the volunteer editor, the CRM contact, a serving's Texts and Survey and itinerary cards, a test confirm link, /me and /privacy. No page errors.

### Found and fixed

- **The CRM's source file was behind its build file.** Wave176's change to the CRM (one write, the new note) was made in the assembled file only, so re-running the CRM's assembler would have brought back the second write. The source (`parts152/d_sheet.js`) now carries it. Older segments 122, 123 and 129 have the same kind of drift from earlier waves; ARCHITECTURE.md now says not to re-run those three assemblers.
- **/me offered a Google sign-in that volunteers can't complete** (the Hub's Google app is team only since wave175b). Signed out, it now says volunteer accounts are coming to welfareavenue.com and that the link in our texts has everything for the next serving. `?try=1` opens the sign-in on one browser for testing; anyone already signed in is unaffected.

### Refresh

- **The name:** the CRM, its forms, its reports and the access screens say "the Volunteer Manager" instead of "MTL volunteering".
- **CRM to Volunteer Manager:** a volunteer's contact has "Open in the Volunteer Manager", which lands on that person's editor (the editor already links back with "Open in the CRM").
- **Less repetition:** inside the app on a computer, the page's second title and intro give way to the masthead and the rail. Phones are unchanged.

### For Steel

- **53 contacts from Keela are tagged volunteer but have no volunteer record,** so they are in the CRM but not in the Volunteer Manager (plus 1 from the old website that looks like a duplicate of an existing volunteer). They were like this before wave176. They can be added to the Volunteer Manager, or have the volunteer tag removed.
- **41 possible duplicate pairs** are waiting in the CRM's Possible duplicates.

Live Hub md5 b73865396ade0028a6fb55e682bb5bd9; /me 1d4fb836572a43b61bee68e76ecf9b16.
