# 15/10/26 - wave240: content for each serving

Steel, 14/10/26 marketing meeting (Ian: "we don't have someone to take pictures"; Roberto's LinkedIn questions kept apart
from the Instagram and TikTok ones; a throwback to the last time with Oberoi; the photos go to the Google Photos album).
Live 15/10/26 about 12:30 Toronto.

## The serving page: a Content card in Plan (build/src/240_wave240.seg)
- After the collaboration card (or the stage line): the photographers and videographers on the roster (confirmed in teal,
  not confirmed yet in gold), or "No photographer yet" with "Find one: Volunteers > Photographers" (opens the Volunteers
  list on the Photographers chip, where Text: still in? reaches the past photographers) and the note that within 5 days
  the Hub gives the SOP's photographer owner a task to book one.
- Album: the serving's own Google Photos album link (made by hand in Google Photos, shared, pasted here; the Photos API no
  longer shares albums). Until it has one, the photographer's page points at the shared album.
- Brief: the LinkedIn questions (longer answers, for the article), the Instagram and TikTok questions (one question, short
  answers on video), the shots to get and notes. Saved through `wa240_event_content_set` (staff; change_log lines); shown
  to photographers and videographers on their page once they confirm (and in the early window), with "This serving has
  its own album" when it has one.
- Throwback and recap ideas: for a serving with a partner organization, "Add them now" calls `wa240_event_ideas(event)`.

## The photographer's page and text (volunteer_confirm_get, wa171_confirm_text, patched in place)
- `album_url` and `brief` come back for photographers and videographers; the guide's shared-album link is replaced by the
  serving's own album when set. The /c/ page shows the brief (build/c/src.html `briefHtml`, after the role guide).
- The confirmation text ends with "Album for your photos: <link>" (FR "Album pour vos photos : ") when the serving has one.

## The photographer check (wa240_photo_check, cron wa-photo-check daily 14:15 UTC)
- For each serving within 5 days with no photographer or videographer confirmed and no open task yet: a task "Book a
  photographer for the serving on <day>" for the SOP's photographer owner (wa239_photo_owner: the next serving's
  "Volunteer Photographers" step owner, else Ian), due the day before, priority, with the ways to book one and the marker
  `[serving <id>]`. The owner gets notify's "A task is now yours" on Slack and a Hub notification (hub-push task_assigned,
  when push is on and a device exists). Once a photographer confirms, the task closes itself ("the Hub (a photographer
  confirmed)"). change_log `photographer_check` lines.
- Then `wa240_event_ideas()` for the partner servings of the next 10 days (and yesterday's).
- Not run by hand today: the first run is 16/10 at 10:15 Toronto. Oberoi (18/10) is 2 days out then: Ian gets the task
  unless a photographer has confirmed by then. `select public.wa240_photo_check();` runs it now (postgres or an admin).

## Throwback and recap ideas (wa240_event_ideas)
- A serving with a partner organization that served with us before (same partner id or name, or a serving titled after
  them): "Throwback: last time with <partner> (<date>)" for two days before, on LinkedIn, Instagram and Facebook, with a
  caption and notes (where the old photos are, what to say). Made today for Oberoi: idea 57 ("Throwback: last time with
  Oberoi Financial Group (25 June 2023)", for 16/10). The recap ("Recap: <partner> served with us on <day>", for the day
  after, with the album link and the serving run's numbers to fill in) is made from the day before the serving: Oberoi's
  comes on 17/10. Both are Content Studio drafts suggested by the Hub; once there, not made twice.

## Deploy
- Database: build/data/wa240_event_content.sql (migration wa240_event_content; wa240_event_ideas and wa240_photo_check
  re-created after a loop-variable fix; execute on wa240_photo_check revoked from anon and authenticated, on
  wa240_event_ideas from anon). Columns volunteer_events.photos_album_url, content_brief.
- Front end: index.html 35c48f8a567f90f9ab1716c728d42abf (7,196,785 bytes) over 686584e6; c/index.html
  cb512cfbf5c9b863601d27e7d2d56a95. Stage tables wa_stage_240, wa_stage_240c, wa_stage_sqlq240 (policies closed).
- Tests: test/w240drive.js 20 of 20 (the card's place, no photographer, the editor and its save, the http link refused,
  the ideas call, Find one, a confirmed photographer, the album and brief lines, no partner, phone width); test/w239page.js
  13 of 13 (the /c/ page: the Still in? screen in English and French, the answer and the change of mind, a photographer's
  brief and album, none without a brief).
