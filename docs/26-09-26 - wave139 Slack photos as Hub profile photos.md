# 26/09/26 - wave139: Slack photos as Hub profile photos

Live md5 `b4dea6b36c172a9fb3c0be6ba0eec82b` (3,884,752 bytes), deployed through the gated pipeline (`wa_stage_rj`, guarded on the live md5 `07f597fd` and dropped after). Schema: `wa139_photos` (the `avatar_url` comment). Edge function: directory-sync v7.

## What Steel asked

"Can you grab everyone's Slack photo for their profile photo on the Hub?"

## What it does

- **Everyone's Slack photo is their Hub photo**, matched by work email (or a Workspace alias, or the Slack account they connected in Settings). 17 people got one today: Valex, Mary, Edison, Alexis, Soraya, Amanda, Ian, Eleftherios Katsipis, Patricia, Eno Moffat, Daniela, Joy, Kahkashan, Ahmed, Melvina, Shima and Brianna. Valex and Shima had their Google photo before; the Slack one replaces it.
- **A photo someone uploaded on the Hub is theirs** and stays (Steel's). A Slack default avatar is not used.
- **Removing a photo is respected**: the profile editor now saves "no photo by choice", and the daily sync does not bring a Slack or Google photo back. The editor says where the photo comes from until you choose one.
- **It keeps itself current**: the daily roster sync (directory-sync) refreshes a Slack photo when the person changes it, and fills one in for someone who adds a photo to Slack or joins later. Placing a new person on the roster copies their photo at once.
- The photos are copies in the Hub's avatars bucket (`slack/<member_id>`), like the Google ones, so the Hub never shows a Slack link.
- **Ian's photo comes from his personal Slack account**, the one the Hub now delivers to (pinned in `wa_slack_ids`; directory-sync v1.6 takes a pinned account before the email match).

## Who is still on initials

- **A Slack default avatar** (no photo on Slack yet): Alyx Denison, Suhaib, Samson, Tuna, Eduardo de Freitas, Alejandra, Karan, Tate, Ibrahim Awad, Ola, Zachee Leonel Ngue and Sama. Their photo appears the day after they add one on Slack.
- **No Slack account with their roster email**: Jemeela, Tamara (keeps her Google photo) and Kellian.
- **No email on the roster**: Rima Naim, Gamze, Mohamed, Cindy, Robert, Mandeep, Gabe and Bela Hundra.

## How it works underneath

- directory-sync v1.5 (deployed as v7): `slackPhotos()` reads Slack's users.list with the bot token, matches roster emails, skips photos uploaded on the Hub (`u/`) and removed ones (`avatar_url` = ''), uses only custom Slack photos (`is_custom_image`), copies `image_512` into the avatars bucket and keys it by the Slack `avatar_hash`, so an unchanged photo is not copied again. It runs after the Google pass in the daily sync; the Google pass leaves `slack/` photos alone. `{action: 'slack_photos', dry_run?}` runs it on demand (admins and the automation).
- The profile editor (wave115) saves `''` when someone removes their photo.

## Release checklist

- **Access:** no change. Photos show where avatars already showed; the avatars bucket was already public for the Google copies.
- **Training:** no tour or lesson describes where profile photos come from; the profile editor now says it.
- **Security review:** the Slack pass runs inside directory-sync with the bot token from the vault; it only reads users.list and writes `team_members.avatar_url`, the avatars bucket and `change_log`.

## Verification

- A dry run listed the 17 before anything changed; the real run copied 17 with no errors, and a second dry run found all 17 unchanged (kept). All 17 files load publicly as images.
- `test/w139drive.js` 7 of 7 (a Slack photo in the profile bubble, the editor's wording, removing stores no photo by choice, initials after). `test/w138drive.js` 37 of 37 again. The harness for three identities shows no page differences from the live build.
- Live: the md5 matches the build.
