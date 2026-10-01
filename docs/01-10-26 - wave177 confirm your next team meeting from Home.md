# 01/10/26 - wave177: confirm your next team meeting from Home

Steel (30/09/26): "When a member is on their home page could you prompt them with confirming their attendance to the next team meeting so that the accept button is click on google calendar"

His answers:

- **Which meeting:** their next team meeting (a meeting tied to a team) in the next 7 days that they haven't answered.
- **The choices:** Accept, and I can't make it, with a note to let their leader know at least 24 hours before.
- **Google Calendar off:** Accept switches it on and accepts in one go. The card says so, and Settings turns it off.

Then: "I'd rather it be a pop up rather than a section in the home page. A pop will prompt them to answer it". So it is a pop-up.

## What a member sees

A moment after they open Home, a pop-up (a centred window on a computer, a sheet from the bottom on a phone) shows:

- The team and the meeting.
- When it is (Today, Tomorrow or the date, Toronto time), with the Meet link.
- **Will you be there?** with Accept and I can't make it.
- A note:
  - Their answer goes to Google Calendar, so their leader sees it.
  - If they can't make it, they should let their leader know at least 24 hours before. Under 24 hours, the card says to message them now.
  - When Google Calendar isn't on for them, answering switches it on.

- **Ask me later** (also the x, or Escape) closes it until they next come back to Home.

After **Accept**, it says "See you there", the reply is on their Google Calendar, and it closes by itself after a few seconds. After **I can't make it**, it says the decline went to Google Calendar and asks them to also let their leader know; it stays open until they close it, so they read that. Either way it doesn't ask again during that visit; the next unanswered team meeting, if any, comes up the next time they open Home.

It never opens on top of another window (the Hub's own windows, the welcome window, a tour step or the Academy's sheet) and waits for that window to close. Leaving Home closes it.

## Rules

- **A team meeting** is a `hub_events` row with a `department` (Operations, Fundraising, HR, Marketing, Program Development and so on). 1:1s and small group meetings are left out.
- **Their leader** is the meeting's organizer (today: Ahmed, Amanda, Valex, Ian and Shima for their teams).
- **No card for:**
  - the organizer;
  - anyone not invited;
  - anyone who already answered;
  - all-day or cancelled events;
  - meetings that have started;
  - board members (staff only).
- **The reply** is a real Google Calendar reply as them (hub-connect `rsvp`, wave116j's domain-wide delegation, `sendUpdates=all`), so the organizer is told the way Google always tells them. Nothing else is sent.
- **If Google Calendar can't be switched on** (for example a non-welfareavenue.com account), no reply is sent. The card says why and links to the meeting in Google Calendar.

## Built

- `build/src/177_wave177.seg` (in MANIFEST after 180): the pop-up `#w177pop` with the dialog `#w177card`. It reads `hub_events` for the next 7 days, and calls hub-connect `toggle` (only when Calendar is off), then `rsvp`.
- No database or edge function changes.

## Tests

- `test/w177drive.js` (32). Covers:
  - Picking the meeting: not the past one, the 1:1 or the one already accepted.
  - The wording.
  - Accept switching Calendar on, then the reply.
  - The next meeting coming up.
  - Declining.
  - The error path.
  - Under 24 hours.
  - Calendar already on.
  - The organizer and someone not invited.
  - The pop-up: Accept has the focus, Ask me later, Escape, back on the next visit, not over another window, leaving Home.
  - The phone.
- The full drive regression, compared with the build before.

## Worth knowing

- When this shipped, only 2 people had Google Calendar on for the Hub, and 33 of the 44 replies for the week's team meetings were blank.
- The HR meeting is titled "Human ressources meeting" on the hub@ calendar. The card shows the title as it is on the calendar.

## Deploy note (01/10/26)

- Another session deployed wave185 (receipts by email) without pushing it to GitHub yet. To keep it live, wave177 went out as the live page plus the 177 segment, not as a fresh build.
- **Live md5:** 55d5b03a661806e9e2e3fed8d5df2baa.
- **Warning for wave185's session:** pull before the next push. MANIFEST.txt now lists 177_wave177 after 180_wave180. A push or deploy without that line would remove the pop-up.
- **Speed:** on a slow load, the pop-up appeared about 2 seconds after Home showed; the meetings are loaded as soon as Home's body exists.
