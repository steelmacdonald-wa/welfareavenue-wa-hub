# 09/10/26 - wave222: the loading screen waits for the Hub to start

Live md5 caf564fa006f4aaec41bfdca3fbd2038 (on wave221's da973901).

## What Steel asked
"The hub is doing that thing again for almost every page where it at first loads one of the oldest versions of it, then changes again and loads to a more recent version, and does that a few times until it actually gets to the most updated and recent version, all within seven to nine seconds. Can that be fixed so the loading doesn't have that happening again?" Both on a computer and on a phone.

## What was happening
Every wave wraps `startApp` and draws its part of the page after its own data arrives, one after another. The loading screen (wave110's veil) lifted when that chain finished **or after 9 seconds at the latest**. With 220 waves the chain takes longer than 9 seconds on a real connection, so the veil gave up with the page half-built and the reader watched the last waves repaint it: an old layout, then a newer one, then the current one. Measured offline with every request slowed to 400 ms: the chain took 11.5 s, the veil lifted at 9.4 s, and My page changed 52 times and the Dashboard 83 times in front of the reader over the next 4 seconds. At 150 ms the chain finished in 4.6 s and the page appeared whole, which is why it comes and goes with the connection.

Underneath that, a second flicker: waves 120 and 121 put the Analytics and Content calendar entries back into the menu for any staff member every time the menu changed (a count badge was enough), while the access gate (`wa40Enforce`) hid them again for profiles that do not carry those pages (HR members: leads only). The two took turns every second or two, for as long as the page was open.

## What changed
- `110_wave110`: the veil lifts when the start chain has resolved, then the menu has settled (wave163, at most 1.5 s), then the page has been still for a moment (no visible change for 180 ms, at most 1.2 s). The 9-second cut-off is gone; only a start that never finishes is cut short, at 25 seconds (the menu's own failsafe is 20). The sign-in screen still shows at once (wave175b). `window.w222.state()` says when the start finished, when the veil lifted and why (`started`, `failsafe`, `no startApp`).
- `120_wave120`, `121_wave121`: `placeTab` shows its entry only when `wa40Allowed()` carries the page (`tabOk222`), the same list `wa40Enforce` reads, so the two agree.

## What it means for people
On a slow connection the loading screen stays up a little longer (it shows the week's lines and the news banner meanwhile) and the page then appears once, whole. Figures that arrive on their own after the start (the Dashboard's executive summary, count badges) still fill their card in place a moment later; nothing is replaced by an older layout.

## Verification
- `test/w222drive.js` 13 of 13: a normal load for an admin, a member on a phone and a board viewer (the veil lifted after the start, `why: started`, no page errors); a slow load (every request 250 to 750 ms, the start past 9 s) for an admin on the Dashboard and a member on a phone: the veil waited, and the page's structure and the menu did not change after it lifted; signed out: the sign-in screen within 2.5 s.
- `test/w222probe.js` measures a page's start: when `startApp` resolved, when the veil lifted, and the visible changes after it in 500 ms buckets.
- `test/w163drive.js` 40 of 40 (its slow-load case now waits 20 s), `test/w134drive.js` 34 of 34, `test/churn.js` zero on all 15 pages. `test/w120drive.js` and `test/w121drive.js` fail the same way on the untouched live build (fixture drift), not this wave. Menu entries checked per identity: admin, a Marketing member, a leader and a board viewer see Analytics and Content calendar; an HR member does not (the HR profile gives them to leads).

## Build notes
- Built by swapping the three segments into the live build (`build/w222_splice.py`): each sat verbatim in it. Two parallel sessions shipped wave220 (team phone numbers) and wave221 (the Hub, not AI) during this session; the build was re-based on wave221's live file (`121_wave121` had changed) before the deploy.
- `build/candidate.html` in the repo is wave221's; rebuild from the sources.
- The stage table `wa_stage_222` and the pull table `wa_tmp222_pull` are left for the sweep. Ten base64 rows (parts 101 to 110 except 105) were posted by mistake into a parallel session's `wa_stage_220` before the number clash was seen; its gate reads the plain parts first, so they changed nothing.
