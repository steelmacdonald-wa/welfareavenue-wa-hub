# Searchable Apps launcher

The first integration from the productivity lab brings its compact Apps launcher into the maintained Hub source. The launcher now offers a search field, smaller rows, a visible Current marker and keyboard navigation. On a phone, Menu includes Find an app, and the launcher keeps its search and close controls visible while its results scroll.

The existing app registry supplies every choice. Your apps and More apps retain the current team ordering, and availability continues through `appOk`, `yours` and `open`. The Website entry remains an external link. Colors use the current brand palette and its existing app accents.

The implementation lives in `build/parts153/b_css.js`, `c_frame.js` and `e_wire.js`, with the phone menu entry in `build/src/163_wave163.seg`. The wave153 assembler regenerates `build/src/153_wave153.seg`, and the normal build regenerates `build/candidate.html`.

Typing, text selection, focused app choices and list scroll survive an access-driven repaint. Closing the launcher restores focus to Apps on a computer and Menu on a phone. The entry animation follows the device's reduced-motion preference.

## Verification

- Eight DOM regression cases cover access-filtered choices, team ordering, current-app semantics, search, text selection during repaints, keyboard routing, empty results, changing permissions, phone focus recovery and the external Website link. Run `npm ci --ignore-scripts --no-audit --no-fund` in `test`, then `npm run test:launcher`. The development dependency is pinned to `jsdom@29.1.1`.
- The assembled build passes the repository's brand and team-label guard and its inline JavaScript syntax checks.
- The assembled application was checked in the in-app browser with the repository's offline Supabase stub. Checks included opening Apps, filtering to Volunteer Manager, opening its existing route, and using Menu to search and close the launcher in a 390 by 500 phone viewport.

These checks cover the launcher integration. The remaining productivity-lab workflows require their own source changes and verification. Production authentication and database permissions require validation against the organization's test environment.
