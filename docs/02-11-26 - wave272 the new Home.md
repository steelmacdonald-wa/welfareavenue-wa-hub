# 02/11/26 - wave272: the new Home, Set up your Hub, and Home for directors

Steel (01/11/26): "I need like a better UI. Maybe it should look like more of an Apple design. I really want you to consider that the homepage is for everyone"; "ensure you aren't removing any functionality from the old home page"; directors: "Yes, give them Home"; "make it part of onboarding and a pop up on hub to add the hub as an app on their phone and computer without it looking forced only encouraged. Also I want a very easy experience for setting up the notifications"; "Checking to ensure the mentions piece is also always there"; "Once this is done please build and publish to the hub".

## How it works
Nothing is rebuilt. Every card the older waves draw on Home stays theirs, with its wiring. `build/parts272` lays them out with CSS (a grid and `order` on `#mpBody`, on top of wave262's focus rules) and adds a few things. A new Home card shows by default and needs an `order` in `b_home.js`, or it lands at the start of the grid.

| Part | Where | Notes |
|---|---|---|
| Plain sentence | `#w272sum`, in `.mp-head` | The chips stay, as the same buttons |
| Up next | `#w272next` | Open task uses `w116Board.open`; Mark as done uses `toggleTask` with a 5 second Undo; Do this later is per device, for the day |
| My tasks, today first | `.w272lt`, `#w272laterbtn` | The rest waits behind Later, remembered per device. Wave109's own tick and Undo are unchanged |
| Your apps | `#w272apps` | `WA_APP.yours()`. The launcher stays |
| Set up your Hub | `#w272setup` | Stands in for `#w219card` while it shows. Not now hides it; a button under Show everything brings it back |
| The small note | `#w272tip` | At most twice per device, 14 days apart, 25 seconds after the start, only on Home, only when no other window is open. No scrim, takes no focus |
| How-to window | `#w272sheet` | Tabs for iPhone, Android and Computer |
| Films | `e_howto.js`, `window.w272howto(host, kind)` | Silent. Every frame is a function of `seek(t)`. Autoplay stops for reduced motion |
| Directors | `d_director.js`, wave74, wave260 | Greeting, Set up your Hub (the app only), their meetings, their Board pages |

Mentions (`#w65menbox`) is always on Home for staff, with its empty message when there are none. `test/w272drive.js` fails if it is hidden, in either Show everything state.

## Onboarding
- Get started (wave112): a sixth step, `app`, which ticks itself when the Hub is added. Anyone who already finished is not asked again.
- `onboarding_template` row `wa272appsetup` (WEEK 1): the trigger adds it to active onboardings. Nothing is sent.

## Directors
- `hub_access_profiles` board: `pages.mypage` goes from none to all. This is the real switch: wave127 replaces `wa40Allowed`, so without it a director is refused Home.
- Hub notifications stay staff only (`wa219_push_save` checks `is_wa_staff`), so directors see the app step alone. Announcements, tasks and mentions are also not on their Home: those policies and cards are staff only. Opening them up needs database changes and Steel's call.

## Corrections to the preview
- Home already had Undo on a tick (wave109), and the phone already had a tab bar (wave163). Neither is new.
- Search and Ask the Hub stay separate in this release. The one combined box in the preview is not built.
- No drag to dismiss on the how-to window, and no dark mode: the Hub has no dark mode.

## Steps the films show
- iPhone: Apple, "Turn a website into an app in Safari on iPhone" and "Bookmark a website in Safari on iPhone" (iOS 26). The film shows the Page Menu route; the written steps name the Share button for other Safari layouts and Edit Actions when the row is missing.
- Android: Google Chrome Help, "Use web apps" (More, Add to home screen, Install).
- Computer: Google Chrome Help for Chrome; Apple, "Use Safari web apps on Mac". The Edge route is from memory of Edge's menu and needs a look on a real machine.
- Apple only allows Hub notifications from the Home Screen app, so on an iPhone the second step waits for the first and says why.

## Tests
`test/w272drive.js`: admin, leader, plain member and HR member, computer and phone, then a director on both. `test/w272film.js` renders stills of the films. On Windows set `WA_CHROME` to a Chrome path, and `NODE_PATH` to a folder with playwright. `build/assemble_all.js` is the same assembly as `build.sh`, without a slow shell loop.

## Undo
Run the same pipeline with `build/candidate.html` from the commit before this wave, set `pages.mypage` back to none on the board profile, and set `onboarding_template` row `wa272appsetup` to `active = false` (the trigger removes it from active onboardings).
