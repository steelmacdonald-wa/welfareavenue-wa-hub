# 25/09/26 - wave118: brand depth, the admin sections, check-in nudges

Steel: "I think you can likely add more brand elements in to the hub" (with the wa-brand skill), "distribute the admin section into different sections: AI models, workspace accounts, people and access, security and audit trail, change the hub", and "when people open the dashboard if they aren't yet checked in and they haven't opened it for a while prompt them to check in with a little notif right below the check in bar; if someone leaves from their mobile prompt them to check out, or if it's been longer than a few hours, prompt them to change the check-out time so it's logged properly."

Two segments: `118_wave118` (the skin work; skipped by the classic look) and `118b_wave118b` (the check-in notes; behaviour, so it runs in both looks). Both load after 117, before 110. Live md5 after this wave: `6ac96863917933b3a12be9d91c07cdd9` (2,318,423 bytes), on top of the other agent's wave116t (`160dce6b…`).

## Brand depth (wave118)

Audit first: the wave116 pages (Projects, goals, team pages, Hub inbox) already opened with a section overline, a condensed title and a purpose line; the older pages started straight into a card, the shared controls were browser-default, fourteen emoji glyphs stood in for icons, and empty states were bare sentences.

- Mastheads. Every older page now opens the wave116 way: overline (the sidebar section: Strategy, Meetings, People, Admin, or the team), Barlow Condensed title with the 40 x 3 gold rule, one line of purpose, the page's "How this page works" button at the right. Pages: Executive dashboard, Delivery numbers, Department goals, Requests, Transcript archive, Agendas, Hub inbox, Volunteering, Finances and budgeting, HR centre, Org chart, My trainings, Needs me, Activity, Important info, The Brain, Create studio. Where the page's own first heading repeated the title it is hidden (its help button lifted, a chip kept with the heading slimmed), and the wave85 purpose line under it is reused as the masthead's line and hidden. The wave116 mastheads gained the same gold rule.
- The E that moves: EXECUTIV[E] DASHBOARD, and nowhere else in the app (the gate and the veil already carry one). The brand rule is one per piece.
- One icon system: the glyphs used as icons in buttons, chips and headings (flag, sparkle, folder, chart, clipboard, link, people, target, document, mic, send, menu, close) are inline SVG line icons in currentColor, 1.9 stroke, round joins. The retired classic department panels keep their text (other waves match on it). The phone bar's grey placeholder squares are icons now (home, chart, E, people, dots).
- Details: selects carry a brand chevron; url, tel, password, time and untyped inputs are styled like the rest; focus is a gold ring on a green border, keyboard focus a gold outline; placeholders muted; text selection gold on Ground (cream on green surfaces); thin green scrollbars; table rows warm on hover; buttons press; links keep an underline offset. Reduced motion respected.
- Empty states: `.mp-empty`, `.empty`, `.w116empty`, `.w116empty2`, `.w67empty` share one look, dashed hairline box with the gold asterisk doodle.
- Head: the tab favicon and the iOS icon are the WEL/FAR/E mark on Community green (PNG data URIs, 64 and 180 px); theme-color is Community green. The tour card and Home copy say "Ask the Hub" instead of "WA assistant".

## The admin sections (wave118)

Admin is five sections: AI models, Workspace accounts, People and access (with the access requests and the classic roles table), Security and audit trail, Change the Hub. Sub-links appear under Admin in the sidebar when the page is open; a switcher sits under the section masthead; deep links are `#adminpanel/ai`, `/accounts`, `/people`, `/security`, `/change` (`#adminpanel` opens AI models). One card shows at a time; the cards themselves (waves 86, 96, 113, 116l, 116n) are untouched, hidden or shown by a sibling rule from the switcher, so a card that mounts late still lands in its section. `WA_NAV.pages` carries an onShow for `adminpanel` so the registry dispatcher routes the deep links.

## Check-in notes (wave118b)

A small green note anchored under the Check in pill (`#w116jck`), one at a time:

1. Not checked in, and this device has not had the hub open for three hours (or ever): "Starting a session? Check in so your hours count." Check in goes through the pill, so wave116q's Slack post runs. Not now snoozes it four hours.
2. Checked in and back after being out of sight for twenty minutes or more (tab hidden, app switched away, page unloaded): "Welcome back... away from 12:40": Check out as of 12:40, Check out now (the usual note sheet), Still working.
3. Checked in for more than three hours: "Still here?": Still here, Check out now, Set the time (a time field, defaulting to the last minute the hub was in sight). Asked again two hours later.

A check-out at a chosen moment writes `ended_at` and `minutes` on the open `hub_checkins` row, then calls `checkin-post {action: out, skipped: true}` so the Slack line and the row's summary fields follow the normal path (the function keeps an `ended_at` that is already set), then a change_log line "checked out as of 12:40 (3h 38m, time set by hand)". Timestamps and the "hub in sight" marker live in localStorage (`w118bSeen`, `w118bHid`, `w118bSnooze`, `w118bAsked`).

## Build and test

- `build/w118_gen.py` writes `src/118_wave118.seg` (icons, mastheads, admin map, favicon PNGs from the brand paths) and puts `118_wave118` and `118b_wave118b` into the manifest after 117. `src/118b_wave118b.seg` is hand-written.
- Parity: `window.__wa118.clean(el)` returns an element's HTML with every wave118 change undone (mastheads, switcher, sub-links, icons back to glyphs, lifted help buttons put back, copy fixes reverted, the note removed). `test/harness.js` uses it when `W118_STRIP=1`; `W118_STRIP=1 ./compare.sh candidate.html` is ALL GREEN on 33 pages x 3 identities against the live build, error counts equal, `w116drive.js` clean for staff, board and member.
- Screenshots: `test/w117shots.js` as before; the notes were exercised with a fake open check-in (`/tmp/ck_test.js` in the session) for the three states and the time form.

## Deploy record

Verified against live `160dce6b` (wave116t). Deployed 25/09/26 04:02 UTC through the gated pipeline (`wa_stage_pz`, guard on the live md5, `host-sync`), then pushed to GitHub on top of the other agent's head. Three rebases during the build (waves 116n/o/q, 116p/r, 116t landed meanwhile), all through `rebase_live.py`.
