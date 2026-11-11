# Page transitions

The lab's shared page entrance now runs in the maintained Hub. A page change fades the main content in over 300 milliseconds with a seven-pixel vertical movement. App subpages that share one panel use the same transition. Quick navigation continues from the current frame.

The effect follows hash changes. Typing, saving and repainting the current page leave it still. Reduced-motion preferences disable the entrance, switching the preference stops active motion, and print styling shows the content at full opacity. The existing routing, access gates and page-loading sequence continue to determine the destination.

The implementation is `build/parts130/c_motion.js`, with shared CSS in `a_css.js`. Its assembler regenerates `build/src/130_wave130.seg`, and the normal build regenerates `build/candidate.html`.

Five DOM regression cases exercise page and app-subpage changes, editing without navigation, interrupted transitions, reduced motion, initial loading, background pages, pagehide and an unavailable animation API. Run `npm run test:motion` from `test`. The build also passes the brand and team-label guard.
