# 25/09/26 - wave117: the brand feel

Steel: "update hub to have more of the brand feel", "add some animations to the Ask the Hub chat bot, make it look really cool filled with our branding assets", "fill the loading page with strong branding and sprinkle fun facts about Welfare Avenue when it loads", "use github to keep versions and push when ready".

Wave117 applies the brand kit (Welfare_Avenue_Brand_Guides_v1_2026, seeded into `wa_brand` / `wa_brand_assets` and the `content-images/brand/` bucket on 25/09/26) to the parts of the hub people look at most. It is additive: no existing button, route or function was removed or renamed, and every page renders DOM-identical to the previous build for the staff, board and member identities (harness gate). The classic look (`localStorage wa114classic`) skips the whole wave.

## What people see

Loading screen (boot veil, first paint). The veil in `000_head_base` is rebuilt: Dignity green ground with a soft Possibility purple bloom, the vector wordmark with the E drawn in as three bars that slide forward, the tagline in gold, three hand-drawn doodles (gold star, gold flowers, purple heart) and a "Did you know" line that rotates through fourteen public-safe fun facts every 3.4 seconds until the app is ready. The reveal is still wave110's (`html.wa-ready`, 9 s failsafe); the facts script stops itself on reveal and the element is removed as before. Google Fonts (Barlow Condensed, Space Grotesk, Bebas Neue) are linked from the head so the veil and the app share them; the harness aborts that request, which is the expected `ERR_FAILED` in offline runs.

Sign-in gate. Green ground, the lockup as an inline SVG (no PNG), the three doodles floating in the corners, and the headline "Together we mov[E] forward" with the moving E and "forward" in gold.

Sidebar. The PNG logo is replaced by the lockup SVG (wordmark + tagline) at 136 px; the PNG element is kept in the DOM, only hidden, so nothing that references it breaks.

Ask the Hub. The floating pill carries the E-bars icon (the bars extend on hover). The drawer header is rebuilt in green with the WEL/FAR/E secondary mark, the title "Ask the Hub" with its subtitle, and a gold star that pops when an answer lands; the close button is re-appended so it keeps working. Bot messages get an avatar bubble (secondary mark), "Thinking..." becomes a three-dot loader in brand colours, the starter chips carry a gold rule, and the panel slides in. All of it is wired by a MutationObserver on `#wacMsgs`, so wave75/wave81/wave114 logic is untouched.

Small touches. The dashboard's accent stat gets an E watermark, the team page hero gets the flower doodle, empty states get the asterisk, the toast gets a star, the top bar's Ask button gets the E icon. Reduced-motion users get no animation at all.

## Where the code is

- `build/w117_gen.py` writes `build/src/117_wave117.seg` from `build/data/w117_paths.json` (the vector paths recovered from the brand deck) and `build/data/e_small.svg`, patches the veil in `build/src/000_head_base.seg` (idempotent, structural regex) and inserts `117_wave117` before `110_wave110` in the manifest. Run from `build/`: `python3 w117_gen.py && bash build.sh candidate.html`.
- Bucket images are referenced by public URL under `content-images/brand/`; the wordmark, lockup, secondary mark and the E are inline SVG (no request, recolourable with `currentColor`).
- `test/w117shots.js` takes the visual checks: `ROUTES=mypage,chat,chat_thinking node w117shots.js <candidate> <outdir>`, plus `... veil 1366 veil` and `... gate 1366 gate` for the boot veil and the gate.
- `build/rebase_live.py` re-bases `src/` on the live build before a deploy (another agent ships waves in place); it locates every manifest segment in the live file, adopts changed or new segments, and proves the plain build reproduces the live md5 before wave117 is regenerated on top.

## Deploy record

- Verified against live `2b3a7b0e` (wave116m): harness DOM parity on 33 pages x 3 identities, `w116drive.js` clean for steel/board/member, screenshots of veil (desktop + phone), gate, home, dashboard, team page, chat (desktop + phone, thinking state).
- Deployed 25/09/26 02:14 UTC through the gated pipeline (`wa_stage_px` -> `deploy_gate.py` guard on live md5 -> `host-sync`). Live md5 `d543b292aa427a21d493b5b2d89916e3`, 2,104,406 bytes.
- Two earlier attempts were stopped by the guard because the other agent deployed wave116l (second cut), hub-connect v2 and wave116m in between; each time the workspace was rebased and re-verified rather than forced.

## Facts shown on the loading screen

Only public-safe facts from the brand deck and the website: the student origin and Sunday servings, two cities (Montreal bi-weekly, Toronto monthly), 3,000+ holiday gifts, food as the starting point, the four pillars, the voice rules (people we serve, community, support), youth-powered, the five named colours, the E as a pathway, the hand-drawn doodles, Rally Paper, the vision, the tagline, and what the hub does with meeting notes. They live in `FACTS` in `w117_gen.py`; changing them is a regenerate and redeploy.
