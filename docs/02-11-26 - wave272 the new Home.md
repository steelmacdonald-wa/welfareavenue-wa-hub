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
| Set up your Hub | `#w272setup` | Stands in for `#w219card` and the Policies card. Steel (02/11/26): no Not now; every row stays until done and the card leaves on its own. Rows: the app, notifications, each required policy not yet signed (Open, then Sign; the same tables as wave105). Notifications are turned on through `__wa219.turnOn()` with the result said in the row, never only in a toast; blocked permission shows the browser's own steps and Check again; coming back to the tab checks again |
| The small note | `#w272tip` | At most twice per device, 14 days apart, on any page but Home (Home has the card), only when no other window is open. No scrim, takes no focus |
| The design pass (02/11/26) | `b_home.js` | One dark surface (Up next), one warm surface (Set up your Hub), every other card a quiet group. Native ticks drawn as round controls, 48px rows, hairlines, press feedback on every button, hover only with a mouse, a 140 ms blur crossfade when Up next changes, nothing animating on arrival. The next serving (wave171) and announcements (wave180) are quieted to match |
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

## Second release, 02/11/26 (Steel: notifications did not turn on; redesign with Emil's craft; Policies only until signed; no Not now)
The first live cut turned notifications on through wave219's button, whose only reply was a toast: when something failed, nothing on the card said so. Now the row itself reports: Asking your browser, the browser's own steps when it is blocked (the installed app on Windows included), the reason when a step fails, Try again, Check again, and a fresh check whenever the tab comes back. Steel's own devices on 02/11: two FCM rows, the app's one last saved 30/10 (a later send found one gone), so his app window most likely holds a subscription the Hub no longer has; Turn on re-saves it.

## Third release, 02/11/26 (wave272c, on wave273)
Steel's Turn on answered "This browser did not start the Hub's notification helper. Reload the Hub and try again." That is wave219's `ready(10000)` giving up: `navigator.serviceWorker.ready` never resolved, which means no active worker for the scope, most often because `register('/sw.js')` was refused (site data blocked for the origin, or the worker failed to evaluate). The row now registers the worker itself when the permission is already granted (so the tap is not needed for the prompt), waits for it to become active, and says the browser's own refusal text, or the worker's state, with the step to take (allow cookies and site data for hub.welfareavenue.com; or close every Hub window and open it again). When the permission still has to be asked, wave219 goes first from the tap and the helper is examined only if that fails. The install note (`#w272tip`) checks `elementsFromPoint` at its corners before it shows and stays away from any control; it leaves on the first press elsewhere or after 20 seconds (another session saw it cover a button on the serving page in `test/w258drive.js`).

## Undo
Run the same pipeline with `build/candidate.html` from the commit before this wave, set `pages.mypage` back to none on the board profile, and set `onboarding_template` row `wa272appsetup` to `active = false` (the trigger removes it from active onboardings).
