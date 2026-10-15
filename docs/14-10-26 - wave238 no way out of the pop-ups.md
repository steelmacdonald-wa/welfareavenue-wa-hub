# 14/10/26 - wave238: no way out of the pop-ups

Steel, 14/10/26: "I also don't want people to exit out of closing their tasks or change due dates on the pop up - they must
do it to use the hub. Also answering if they are joining meetings too." Shipped with wave237 (build 7ae4ff65).

## The Loop's Welcome back is a gate (build/src/118b_wave118b.seg)
- When a person comes back with a session still open from another day, or from more than three hours ago, `#w238loop`
  covers the whole Hub (z-index above every drawer and pop-up): Close as of <the time they went quiet>, Set the time (the
  time form opens inside the gate, with a Back button), and Still working only when they were away under three hours the
  same day. No x, no Escape, and the gate comes back after a reload until it is answered.
- The ordinary Welcome back note (`#w118ck`, a long nudge) has no x either. `nudgeBack(row, leftAt)` builds the gate;
  `state().gate` tells the tests; export version 2.

## The meeting check (build/src/177_wave177.seg)
- The pop-up shows on any page once the Hub has started (inHub: sign-in gate down, staff, the tab bar present), not only
  Home, and waits for the Loop's gate. No x, no Ask me later, no Escape: every unanswered team meeting is asked in turn
  (finish() closes and repaints after a quarter second); only a failed reply offers Try again later. Leaving the page no
  longer closes it; the done screens have no x.

## The due-date check (build/src/213_wave213.seg, build/parts213)
- Waits for the Loop's gate (`busyElsewhere()`), starts five seconds after the Hub, and has no way out but Save (the
  wave213 pop-up already stayed until saved; wave237 adds the owner questions).

## Order on opening the Hub
1. The Loop's gate (Welcome back), when there is a session to close.
2. The meeting check (every unanswered team meeting).
3. The due-date check (overdue, undated, meeting-dated and unsure-owner tasks; a lead's unowned team tasks).

## Tests
- test/w177drive.js 36 of 36 (the gate behaviour on any page, the wait for #w238loop, Try again later after a failure).
- test/w217drive.js 36 of 36 (Still in has no x; the gate assertions).
- test/w192drive.js: the `[data-w118b="asof"]` button now lives in `#w238loop`.
