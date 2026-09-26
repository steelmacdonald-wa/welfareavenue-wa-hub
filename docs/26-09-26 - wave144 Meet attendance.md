# 26/09/26 - wave144: Meet attendance

Live md5 `3c1cad7a73e21c78fe9911ab1651c426` (4,018,378 bytes), deployed through the gated pipeline (`wa_stage_ro`, guarded on the live md5 `ebf852bd` and dropped after). Data: migrations `wa144_meet` (the tables, the helpers and the rules), `wa144_meet_cron` (the run every six hours), `wa144_meet_grants` (the helpers for signed-in people only) and `wa144_access` (the access profiles and two Hub modules). Function: `meet-attendance` v5 (new). Page: segment `144_wave144` (and a corrected header on `143_wave143`).

## What Steel asked

"go for all the above": the Google projects the delegated access opened. This is the second, Meet attendance.

## Where it comes from

- **The Google Meet log** (Admin Reports API, application meet, `call_ended`): one line each time someone leaves a call, with the meeting code, the conference, the calendar event, the organizer, who it was (their Google account, or only a display name when signed out) and how long they stayed. Google keeps six months, from April 1, 2026 today; the Hub keeps its own copy from now on.
- **The hub@ calendar**: the meetings people invite hub@ to. Today that is each team's meeting (HR since April, Program Development since July, Marketing since August, Fundraising and Operations Montreal since September) and three leadership meetings. It gives the scheduled time and who was invited.
- **The board meetings** (board_meetings and board_members): the directors are expected.

## How a call becomes attendance

- A call is matched to a scheduled meeting by its Meet code and its time (an hour before the start to half an hour after the end). A meeting restarted on the same link counts once. A call on a team's link with nothing scheduled is kept when two or more people came.
- A board meeting is matched to the call around its time where the most directors are recognised.
- People are recognised by their Google account (Workspace aliases and the dotless spelling folded together). Someone signed out is matched by their display name, first against the people invited, then (full name only) against the roster. A signed-in personal account is matched by full name only.
- Someone counts as there after three minutes on the call. Meeting notetakers (Loom Notetaker and the other recorders) are left out. A meeting with no call on Meet (in person, moved or cancelled) is kept but left out of the numbers.
- The team's number is the team's own people among those invited (leaders invited to other teams' meetings do not pull it down); the invited number counts everyone on the invite.

## What the Hub shows

- **Each team page**, under Upcoming meetings, **Meeting attendance**: the last eight meetings as bars (how many of the team came, or "no call"), the average, and your own attendance. Click a meeting for the day. Whoever runs the meeting, the team lead, the admins and the Executive profile also see **who came** (a dot per meeting, how many of those they were invited to, minutes on average, a name in red after three misses in a row), the others invited, anyone who came without an invitation, and **who is on the team but not on the meeting invite**.
- **The HR centre** (admins and the Executive profile): every team's attendance over eight weeks with the trend against the eight weeks before, the invited attendance, the last four leadership meetings (click one for who came), **Worth a check-in** (people who missed their own team's last three meetings with a call, with "a kind word first") and **Refresh now**.
- **The Board overview**: under Last meeting, how many directors came; on each director's card, their board meetings in the last twelve months.

## Who reads what (the database decides)

- Everyone on a team reads that team's meetings (the counts) and their own rows.
- Whoever runs a team meeting and the team's lead read everyone's rows for that team.
- Leaders read the leadership meetings' counts and their own rows.
- Whoever sees the board (directors, advisers, leaders with the board pages) reads the board meetings and their rows.
- The admins and the Executive profile read everything. Nobody outside the Hub reads anything (anon is refused).

## What the numbers said on the first run (26/09/26)

54 meetings since April: 39 team meetings, 13 leadership meetings, 2 board meetings; 48 had a call. Over the last eight weeks, the team's own people came to 63% of Fundraising's meetings, 67% of HR's, 48% of Marketing's, 90% of Operations Montreal's and 67% of Program Development's. Five of the six directors came to each board meeting. Operations Toronto has no meeting on the hub calendar.

## How it works underneath

- `fn/meet-attendance/index.ts`: `meetLog()` pages through the Reports API; `calendar()` reads the hub@ instances; `roster()` builds the email folding (directory aliases, dotless spelling), the members, the directors (keyed by their Welfare Avenue address when they have one) and the name candidates; `personOf()` and `nameMatch()` recognise people; `buildMeeting()` sums each person's sessions and the meeting's counts; `sync()` upserts the window's meetings, replaces their rows and removes meetings the calendar no longer has. `dry` returns everything, with the unrecognised names, for checking.
- `144_wave144.seg`: `load()` reads `meet_meetings` and `meet_attendance` (paged), `paintTeam()` after `#w116meet`, `paintHR()` after `#w103scope`, `paintBoard()` on `.w126meet` and `.w126dir .ft`; MutationObservers put them back when the pages repaint (with markers so they do not loop); tour steps on the team page and the HR centre.

## What the challenge changed

- The first count used everyone invited: Operations Montreal's September 18 meeting read 5 of 14 (36%) because other teams' leaders are on its invite, while all five of the team came. The team number now uses the team's own people; the invited number sits beside it in the HR centre.
- AI notetakers were counted as guests (up to three a meeting). They are left out.
- A signed-in personal account could match a teammate by first name alone. It now needs the full name; first names only work for signed-out guests among the people invited.
- The first card went on the board and exec pseudo-teams, and could put itself back and take itself away in a loop for a team member. It shows on real teams only and decides before it draws.
- Names are for the people who run the meeting and the leads: a team member's browser never receives anyone else's rows.

## Things to look at (not changed by the Hub)

- **Operations Toronto** has no meeting on the hub calendar: invite hub@welfareavenue.com to it.
- **Robert** is on the Marketing roster with no email, and **Roberto Toto**'s Workspace account joins the Marketing meeting without being on the roster. They are probably the same person: linking them in Admin > People and access puts him on the invite and in the numbers.
- Program Development had no call for two of its four meetings since July, and Marketing had none on September 23.

## Release checklist

- **Access:** new tables readable only as above; the Executive profile, the Board member profile and every team profile say what they see; the team profiles' lead note says a lead sees who came.
- **Training:** the team page tour and the HR centre tour have a step; Hub module 2 (department pages) describes the card; Hub module 9 (who sees what) says who sees names.
- **Security review:** one new function (trigger secret or an admin or the Executive profile); three helper functions for signed-in people only; no secrets in the page; nothing kept from the log beyond who, when and how long (no locations, devices or network data).
- **Tests:** `test/w144drive.js` (34 checks: the card's place and numbers, a day's detail, who comes, the others invited, the explanation, a team with no meeting, the HR centre table, leadership meetings, Refresh now, the tours, the board decorations, a team member, the person who runs a meeting, a director, no page errors). The live-versus-candidate harness differs only on the HR centre (the card) and known timing noise. Row level security checked as a member, a leader, an admin, a director and a stranger.
