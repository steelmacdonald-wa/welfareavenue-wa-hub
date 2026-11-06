# Design review brief: any Toronto Volunteers wave (for one reviewer with no other context)

You review the screens one wave of the Hub's Toronto Volunteers app adds, against Emil Kowalski's design engineering
rules as they are written for this app. You read and you look; you do not change any file. The repository is
`/home/user/welfareavenue-wa-hub`.

## What to read

1. The wave's brief, section 6 (the design bar): `docs/toronto/waveNNN brief.md`. Those rules are the standard.
2. The plan's section 6: `docs/05-11-26 - the Toronto Volunteer Manager plan.md`.
3. The wave's CSS and the code that draws its screens: `build/partsNNN/*.js` (the stylesheet is the element `#waNNNcss`).
4. The screenshots the builder saved (the folder is given to you), at 390 px and 1366 px.

If the skills `emilkowalski-skills:emil-design-eng`, `emilkowalski-skills:animation-performance` and
`emilkowalski-skills:mobile-native` are available to you, load them first and apply them.

## What to check

- **Look**: the Hub's tokens only (the `:root` variables in `build/src/000_head_base.seg`), Barlow Condensed titles in
  sentence case, Space Grotesk text, the Hub purple as Toronto's accent; one primary action per screen; the numbers people
  act on are the largest things on the card; spacing on one scale; nothing crowded at 390 px; nothing sideways.
- **Motion**: every value against the design bar. `transition: all`, `scale(0)`, `ease-in`, a UI duration over 300 ms
  (sheets excepted), keyframes where a transition should be (anything that can be interrupted), stagger or bar fills
  that replay on a filter, search or save, hover without `@media (hover: hover) and (pointer: fine)`, a missing
  `prefers-reduced-motion` rule, animating layout properties (`width`, `height`, `top`, `left`, `margin`, `padding`)
  instead of `transform` and `opacity`, a sheet that exits as slowly as it enters, a popover scaling from its centre.
- **Press and focus**: `:active` feedback on everything pressable, visible focus, 44 px targets on a phone, Escape and
  focus return on sheets.
- **Words**: plain, warm, specific, Canadian spelling, sentence case, no dashes, Toronto's words (event, kitchen, crew,
  "who the meals go to").
- **States**: empty, loading, error and saved states exist and read well.

## What to hand back

Only this, most important first:

1. A markdown table with the columns **Before | After | Why**, one row per issue, each naming the file and the line (or
   the selector) and giving the exact replacement value. No list of Before: / After: lines.
2. Up to five sentences on the overall feel: what already works and should be kept.
3. Anything you could not judge (a screen missing from the screenshots, a state you could not see).
