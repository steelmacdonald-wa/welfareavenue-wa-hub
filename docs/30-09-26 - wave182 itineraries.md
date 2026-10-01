# 30/09/26 - wave182: itineraries that look like the Canva ones, sent by text and/or email, with a photo for the season

Steel's ask (30/09/26): make the itineraries look as good as the Canva ones, give the team an easy way to send them to each serving's volunteers by email and/or text with flexibility, and put a photo on them that follows the time of year.

## What a volunteer gets
- **The itinerary page** (`hub.welfareavenue.com/c/<token>?it=1`, the same personal link as the confirmation): a booklet in the brand. The season's photo at the top with the role, the date and "You start at …"; a green strip (date and serving time, the place, where you start); Directions or Open the route, the WhatsApp group, the ops line; the forecast for the day (Open-Meteo, no key, within 14 days); the route as numbered pins (each cook with Call, Text and Directions, the storage unit, the serving); the access codes (typed by staff in the Hub, never emailed); the bins with photos and what the team leader carries (team leaders and drivers); the team with phones; notes; a band photo, thanks, Back and Print. English and French. Print gives a clean page.
- **The text** (Quo, the ops line): "Hi <first>, here is your itinerary for <date> (<role>, you start at <time>): <link>", the team's note, the WhatsApp link, Reply STOP.
- **The email** (mail-send v4, Resend): the same booklet in email form: the season photo, the role, the strip, the note, Your day, the team, Open my full itinerary, the WhatsApp button, CASL footer. "Updated: …" in the subject for a resend.

## The season's photo
December to February winter, March to May spring, June to August summer, September to November autumn (`wa182_season`). The photo is the serving's own pick (This serving's itinerary), else the season's photo in Text settings (`photo_<season>`, `band_<season>` in `volunteer_itinerary_settings`), else the best ready landscape photo tagged with that season. Ready photos only.

## Sending (the event's roster, block "Itineraries · <Season> look")
- **Send itineraries**: people grouped by role (cooks are not sent a driver's itinerary; they keep their own confirmation flow), quick picks (confirmed, not sent yet, leaders and drivers, servers, everyone, none); by text, email or both (each person by what they have); now, the day before at the itinerary hour, or a set time; a note up to 300 characters; "send as an update" (ticked by itself when someone already had one); previews of the text, the email and the page; Send me a test (email to your own team address).
- **Sent and scheduled**: every send with what it became (queued, sent, delivered, opened, failed, skipped with the reason), and Cancel for anything not gone yet.
- **This serving's itinerary**: the WhatsApp invite link (checked), the photo, whether it goes by itself the day before, and by which channels.
- **Automatic**: the day before, from `sms_itinerary_hour` (17 h Toronto) to 8 pm, by the serving's channels, to the people not declined (`wa182_auto_itineraries`, cron `wa-itinerary-tick` every 5 minutes).

## Safety
- Texts follow `sms_mode`, email follows `mail_mode`; both are **test** today, so only Steel's test phone and the test addresses can receive anything. The assistant never switches either.
- Texts only 8 am to 8 pm Toronto; opted-out phones and emails without transactional permission (`crm_email_permission`) are skipped with the reason.
- Only leaders, HR and admins can send, preview or cancel (checked in the database).

## Pieces
- Migrations `wa182_itineraries` (20261001030000) and `wa182b_preview_claim`: volunteer_events `whatsapp_url`, `itinerary_photo_id`, `itinerary_auto`, `itinerary_channels`; table `volunteer_itinerary_sends`; functions `wa182_*`; template `volunteer_itinerary`; `volunteer_confirm_get` patched (itinerary shown for a preview, from the day before for the confirmed, and once a send is queued); `crm_claim_queued` gains `'itinerary'`; cron `wa-itinerary-tick`.
- `fn/mail-send` v4 (platform version 14): itinerary emails, `itinerary_preview`, `itinerary_test`.
- The page: `build/c/src.html` → `build/c/index.html` (`make.py`). `_headers`: `/c/*` connect-src adds `https://api.open-meteo.com`.
- The Hub: `build/parts171/h_w182.js` (assembled into `src/171_wave171.seg`), test hook `w182` in `z_wire.js`.
- Bin photos in storage `photos/itinerary/bin-*.jpg`.
- Tests: `test/w182drive.js` (31), `test/w182page.js` (30), `test/w174page.js` (41) and `test/w174drive.js` (21) updated.

## Release
Live since about 23:15 on 30/09/26 (Toronto): the Hub at md5 c28888edc5706fc8e2fb8357ea65465c (5,220,767 bytes, rebased on wave181), `c/index.html` ddfd8cce7a2ba37ee6a633df0140b579, `_headers` d7db0aed97985f33b432b81dc23a1fbc, in one host-sync. `change_log` release wave182. Nothing was sent to a volunteer.

## Open
- Bins and the carry list are in Text settings (edit there as the kit changes).
- The forecast's wording can read "Light drizzle · 12% chance of rain" (the day's weather code and its rain chance come separately).
- The Canva version (a brand template autofill) is still a later step.
