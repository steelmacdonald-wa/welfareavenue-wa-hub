# Welfare Avenue Hub: front-end audit findings

Date: 26/09/26. Read-only audit of `/root/wa-hub/build` at commit `d483466` (wave133). No source, build or test file under `/root/wa-hub` was changed. (One import during analysis created a Python bytecode cache file in `build/__pycache__`; it was deleted again. `git status` refreshed git's own index timestamps.)

Tags used below:
- **[OBVIOUS: safe to do now]**: low risk, mechanical, and checkable with the existing harness (`test/harness.js`, the drive tests, `test/tour1.js`).
- **[DECISION: needs the owner]**: changes behaviour, removes a fallback the owner asked for, or is a larger refactor.

## How the evidence was gathered

- Static: the 156 segments were concatenated in MANIFEST order and parsed with acorn and eslint-scope (every global name, every write to it, every read, every wrapper). Scripts and raw outputs are in `audit/fe_work/` (scripts such as `scope.js`, `dups.js`, `families.js`, `dbstatic.js`, `routes.js`, `css_static.js`; readable results in `out_*.txt`).
- Runtime: the real `candidate.html` was loaded in the local Chromium with `test/stub_supabase.js` (instrumented) and the local live-data fixture, with all network blocked. The probes recorded every `db.from`, `rpc`, `invoke`, timer, observer, listener and storage key with its stack, mapped each stack line back to its segment (`fe_work/seg_lines.json`; applying the two remap scripts per segment reproduces `candidate.html` byte for byte), and visited every route as an admin, a leader, a member and a board viewer (`probe*.js`, outputs `*.json`).
- Limits: the runtime probes use a fixture, so code paths that need other data, other roles or user actions (editors, sheets, error states) were not all exercised; the CSS match rate and the per-page reads are lower bounds. Wrapper and replacement detection is by AST and was spot-checked by hand for every item called dead below.
- Note: the brief says 157 segments. MANIFEST and `build/src` both hold 156.

## Top findings at a glance

| # | Finding | Value | Tag |
|---|---|---|---|
| B1 | The base `esc()` does not escape quotes; it is used inside 210 HTML attribute values in 54 segments | Security | OBVIOUS |
| B2 | The public volunteer confirmation page `#confirm/<token>` always fails: it waits for `window.db`, which never exists | Broken feature | OBVIOUS |
| B3 | Six references to names that are private to another wave (`WA46`, `wa46IsHr`, `wa46Render`, `loadTasks`, `__waEvents`, `w116Onboard`) plus an undeclared `sec` | Silent failures | OBVIOUS |
| 1 | The seven classic department panels are hidden but still rendered at boot, twice: about 914 KB of HTML and 18,470 DOM nodes nobody sees | Speed, dead code | DECISION |
| 2 | 338 wrapper layers over 36 global functions (`startApp` 103, `showPanel` 44, `applyHash` 21) plus 26 `hashchange` listeners, 81 MutationObservers at boot (116 after visiting every page) and 107 global click listeners | Understandability | DECISION |
| 3 | The menu is built three times (waves 13, 42, 73), then patched by 10 more segments and defended by 5 observers | Understandability | DECISION |
| 4 | The same helpers are re-written in almost every wave (69 role checks, 86 date helpers, 48 team label or colour helpers, 45 escape helpers, 25 toast helpers) | Repetition | OBVIOUS (staged) |
| 5 | The same tables load many times at boot: `team_members` 18 times from 10 functions, `user_state` 6, `dept_tasks` 5, `change_log` 5 | Speed, repetition | OBVIOUS quick wins, DECISION for a data layer |
| 6 | Build-time remaps mean the source is not what ships: 1,532 colour values and 36 label texts are rewritten after assembly | Understandability | OBVIOUS |
| 7 | About 25 KB of function bodies are fully replaced by later waves and can never run | Dead code | OBVIOUS |
| 8 | Page facts (label, group, help, tour, breadcrumb, access label) live in at least eight separate registries | Repetition | DECISION |

---

## B. Bugs found during the audit (fix first)

### B1. `esc()` leaves quotes unescaped, and it is used in attribute values [OBVIOUS: safe to do now]
- Evidence: `000_head_base.seg:977` `function esc(s) { const d = document.createElement("div"); d.textContent = ...; return d.innerHTML; }`. `escapeHtml` at `000_head_base.seg:1520` is the same. Serialising a text node escapes `& < >` but not `"` or `'`.
- Checked in Chromium: `esc('x" onmouseover="alert(1)')` placed in `data-a="..."` produced an element with an `onmouseover` attribute.
- Reach: `="' + esc(` appears 210 times in 54 segments (for example `040_wave40` puts emails into `data-w40r="..."`). Values come from the database, the Hub inbox, Slack and AI-processed transcripts, so a stray quote can break markup or inject an attribute.
- Fix: make `esc` and `escapeHtml` also replace `"` with `&quot;` and `'` with `&#39;` (what the later local `E()` helpers already do). Text output looks identical. Then the 17 local copies can call it (see finding 4).

### B2. `#confirm/<token>` (public volunteer confirmation) never loads [OBVIOUS: safe to do now]
- Evidence: `031_wave31.seg:164-172` polls `typeof window.db === 'undefined' || !window.db` every 100 ms and gives up after 100 tries. `db` is declared with `let db = null;` at `000_head_base.seg:964`. A top-level `let` in a classic script is never a property of `window`.
- Runtime check (offline, `fe_work/checks.json`): after 12.5 s the page shows "Could not load. Refresh the page."; `typeof window.db` is `undefined` while `typeof db` is `object`.
- Fix: test `typeof db === 'undefined' || !db || !db.rpc`. Then confirm with the owner that texted confirm links are still in use (wave31 templates carry `{{confirm_link}}`).

### B3. References to another wave's private names fail silently [OBVIOUS: safe to do now]
Everything after wave40 lives in an IIFE, so a name declared inside one wave is invisible to the others. These guards and reads therefore never work, and the empty `catch` blocks hide it:

| Where | Reads | Defined where | Effect |
|---|---|---|---|
| `116o_wave116o.seg:97` | `window.WA46.types` | `var WA46` inside `046_wave46`'s IIFE | The Type list on Ask the Hub's editable request proposal is always empty |
| `116p_wave116p.seg:212, 283` | `WA46.reqs` | same | The HR centre hero always shows 0 open hiring requests, and the open positions list is always empty |
| `116p_wave116p.seg:121` | `typeof wa46IsHr` | private to `046_wave46` | `canHr()` always falls back to `isAdmin()`: HR people who are not admins cannot see or edit start dates on the HR centre People cards |
| `116p_wave116p.seg:345-347` | `typeof wa46Render` | private to `046_wave46` | The wrapper never installs: the whole block is dead |
| `116q_wave116q.seg:158` | `typeof loadTasks` | nowhere | Tasks closed while checking out are not reloaded on screen |
| `116j_wave116j.seg:446` | `window.__waEvents` | nowhere | After Accept or Decline on a meeting, the cached attendee status is not updated |
| `116k_wave116k.seg:279` | `window.w116Onboard` | nowhere | Opening a profile never ticks the 'profile' onboarding step from here |
| `065_wave65.seg:646` | `sec` (not declared in `w65SopDrop`) | only in the sibling `w65OnbDrop` | Every SOP move skips its `change_log` entry (ReferenceError caught by `/* log only */`) |

Fix: expose what is needed on one namespace (for example `window.WA46 = WA46` in wave46) or delete the dead branches; use `drag.section` in wave65.

### B4. Small correctness issues [OBVIOUS: safe to do now]
- `087_wave87.seg:338` and `:341` both call `w87Register()`, so `WA_NAV.pages` holds `brain` twice. `WA_NAV.register` should ignore an id it already has.
- `006_wave6.seg:161` `waLoadLeaders` caches the result but not the in-flight promise. `waRenderAgendasPage` runs 8 times during boot, so 8 identical `team_members` queries fire in parallel.
- The help popup for `#overview` still opens as "Decisions" (text from wave61), although the page is the Executive dashboard since wave128.
- The chrome tour step `#needsMeBtn` (`122_wave122.seg:1719`) points at a button that `116_wave116.seg:223` hides with `display:none !important`, so it is always skipped.

---

## 1. Size: what the 3.7 MB is made of

`candidate.html` is 3,794,274 bytes (990,261 gzipped at level 9). The main inline script is 3,735,897 characters. There is no bundled library: supabase-js loads from jsDelivr in the head, and Chart.js (`094`), cytoscape (`087`) and html2canvas (`018`) are injected from CDNs when first needed.

| Part (pre-remap source, 3,792,670 chars) | Size | Share |
|---|---|---|
| Executable code and indentation (includes 58 KB of head markup and CSS) | 2,033,515 | 54% |
| Plain strings (help texts, tours, labels, messages) | 625,054 | 16% |
| CSS strings injected by JS | 455,731 | 12% |
| HTML template strings | 366,782 | 10% |
| Comments | 268,021 | 7% |
| SVG path data in JS | 31,987 | 1% |
| base64 images | 11,580 | 0.3% |

Largest segments: `122_wave122` training academy 257 KB, `000_head_base` 167 KB, `123_wave123` requests 135 KB, `131_wave131` people and access 127 KB, `118c_wave118c` photo library 123 KB, `121_wave121` content calendar 108 KB, `126_wave126` board 100 KB, `124_wave124` calendar 99 KB, `116f_wave116f` strategy pages 86 KB, `127_wave127` access profiles 84 KB, `116_wave116` team pages 83 KB, `120_wave120` analytics 81 KB.

Largest data literals: `TOURS` 33 KB (`122_wave122`), `SECTIONS` 24 KB (`000_head_base`, July seed content), 11 icon maps 24 KB, `WA43_HELP` 5 KB, the photo labelling `SPEC` 4 KB (`118c`), brand vectors 30 KB (`117_wave117`).

### 1.1 Hidden panels cost more than any single segment [DECISION: needs the owner]
- `116i_wave116i` hides `#opsmtl, #progdev, #opsto, #marketing, #fundraising, #hr, #board` with `display:none !important` and redirects their routes to `#team/<team>`. Its own comment: "The classic panels stay in the DOM, hidden, so nothing older breaks."
- `startApp` (`000_head_base.seg:2343`) calls `renderAllSections()` and calls it again after `loadMeetings()`. Measured after boot: marketing 325 KB of HTML (6,463 nodes), fundraising 265 KB (5,391), hr 166 KB (3,404), opsmtl 63 KB, progdev 51 KB, opsto 28 KB, board 17 KB. That is about 914 KB and 18,470 nodes, about 85% of the 21,786 DOM nodes present when the Home page is ready.
- 19 segments write into hidden panels during boot and a short crawl (`fe_work/hidden_writes.json`): `000_head_base` 515 KB, `052` 87 KB, `051` 56 KB, `077` 29 KB, `039` 29 KB, `028` 25 KB, `021` 21 KB, `043` 13 KB, `071` 10 KB, `080` 10 KB, `003` 8 KB, `002` 3 KB and 7 small ones. Wave77 also reads 35 `wa77.<team>.<section>` storage keys for these hidden folds.
- The same applies to `#dashboard` (13 KB, but `111_wave111` clones its children into the Executive dashboard numbers fold, so it is a template, not dead), `#whatsNew` (hidden by `116g_wave116g`, still rendered by 7 write paths) and `#needsme` (redirected to Home by `078`).
- Proposal: make `renderSection(<team>)` a no-op for team ids (keep the function for the write paths that call it), stop calling `renderWhatsNew`, and check `111_wave111` before touching `renderDashboard`. Then the classic-page parts of waves 3, 6, 10, 15, 21, 22, 24, 27, 28, 39, 43, 51, 52, 71, 77 and 80 (the 16 `renderSection` wrappers and the writers above) become deletable. Verify with the drive tests of waves 116 to 116i.

### 1.2 Other size items
- **Duplicate wordmark vectors [OBVIOUS]**: two paths (3,384 and 3,054 chars) are byte-identical in the head veil (`000_head_base`) and `117_wave117`; the 15 KB wordmark path is a near copy. Define them once as an SVG `<symbol>` in the head and `<use>` them.
- **Fonts [OBVIOUS]**: Barlow Condensed and Space Grotesk are requested twice with different weights (`000_head_base.seg:396` and `114_wave114.seg:69`). Inter (`035_wave35.seg:18`, via CSS `@import`) and Public Sans (`097_wave97.seg:23`) are still downloaded although the brand skin overrides them. Load them only in the classic look, or drop them with it.
- **Admin-only and page-only code runs for everyone [DECISION]**: people and access (113, 127, 131: 255 KB), the academy (122: 257 KB), the photo library, board, calendar, analytics and bank waves are all parsed and executed at boot for every user. Lazy loading would need each page to stop wrapping `startApp` and `showPanel`, so it depends on finding 2.
- **Minification [DECISION]**: removing comments and whitespace only (no renaming) would take the script from 3.74 MB to 2.95 MB and from 973 KB to 816 KB gzipped. Comments are useful to readers, so strip them at build time only, and keep the deploy gate's marker checks working.
- supabase-js is loaded as `@supabase/supabase-js@2`, a floating major version. Any 2.x release reaches users untested. Pin it [DECISION].

---

## 2. Dead code

### 2.1 Declarations that can never run [OBVIOUS: safe to do now]
A later top-level `function` with the same name wins at hoisting time, even for calls made earlier:
- `itemLi` in `000_head_base.seg:1549` (1,724 bytes) loses to `004_wave4.seg:139`.
- `renderWhatsNew` and `renderTranscripts` in `000_head_base` lose to `002_wave2` (already stubbed in the Phase 0 compaction; the stubs can go).

### 2.2 Functions fully replaced by a later wave (about 24.7 KB) [OBVIOUS: safe to do now, with one caution]
The later wave assigns a new function without calling the old one, at load time, before `startApp` runs. Everything before the winner is unreachable:

| Function | Winner | Dead bodies |
|---|---|---|
| `wa27RenderProject` | `099_wave99` | `027` (3,177), `028` wrap (883), `051` and `052` wraps |
| `waVolRenderPeople` | `119b_wave119b` | `026` (3,386); `119b` even captures `__people26` and never uses it |
| `loadMeetings` | `116_wave116` | `000_head_base.seg:1701` (2,468) |
| `waFinImportModal` | `090_wave90` | `022` (2,305) |
| `clickupCardHtml`, `clickupChip` | `116g_wave116g` (returns '') | `000_head_base` (1,539 + 719) |
| `renderSearch` | `082_wave82` | `000_head_base.seg:2143` (1,522) |
| `hoursCardHtml`, `hoursBlock` | `052_wave52` (returns '') | `000_head_base` (1,482 + 605) |
| `renderDecFilters`, `decisionMatches` | `116g_wave116g` | `000_head_base` (1,074 + 426) |
| about 20 small forward stubs | various | 120 to 170 bytes each (`renderGoalsPage`, `renderMyPage`, `wa29GoalModal`, `waCd*`, `wa37*`, ...) |

Caution: most replacements are guarded with `if (typeof X === 'function')`. Keep a one-line declaration where a guard depends on it, or move the winning body into the original place and delete the guard. Full table: `fe_work/out_replaced_functions.txt`; every definition chain: `fe_work/out_definition_chains.txt`.

### 2.3 Unused locals [OBVIOUS: safe to do now]
- 17 local functions are never called (3.9 KB): `w65Mentions` (`065`, 1.5 KB), `managerLabel` and `countUnder` (`133`), `svgPrimary` (`117`), `wa63Fn` (`063`), `lastDays` (`120`), `reduced` (`123`), `lsGet` and `lsSet` (`123` and `126`), `taskById` (`116f`), `anyPublish` (`121`), `myFirst` and `lower` (`128`), `ymd` (`118c`), `today` (`119b`). List: `fe_work/out_unused_locals.txt`.
- 43 local variables are never read, mostly copied palette constants (`PURPLE` in 9 segments; `GOLD`, `TEAL`, `FLAG`, `CREAM` and `GROUND` 12 more times).
- `renderExecAgendaCard` (`006`, then a stub in `007`) is never called anywhere.
- Unreferenced debug hooks: `w116lDebug`, `w116nDebug`, `w116oDebug`, `w116pDebug`, `w116qDebug`, `w116rDebug`, `w116tDebug`, `w84Tour` are used by no test. (`w112Debug`, `w115Debug`, `w119Debug`, `w119bDebug`, `w120Debug`, `w121Debug` are used by drive tests; keep them.)

### 2.4 Dead data work at boot [OBVIOUS: safe to do now]
- `loadAll` still queries `clickup_weekly` (`000_head_base.seg:1080`) into `DB_CLICKUP`, whose only readers were stubbed out by `116g_wave116g`.
- `seedIfEmpty` (`000_head_base.seg:1052`) runs two extra queries on every staff boot to seed `decisions` and `dept_meta` if empty. The tables are populated; the static `DECISIONS` array and most of `SECTIONS` exist only for this and for the hidden classic panels. Seeding belongs in a migration.
- The flyout actions of `042_wave42` (`data-w42a`: overview, exec, agenda, tx) are dead: `116_wave116` replaces the flyout HTML with `data-w116` links.
- ClickUp is gone, but `072_wave72` still hides `a[href*="clickup.com"]` and ClickUp chips with CSS.

### 2.5 Help popups are written three or four times per click [OBVIOUS: safe to do now]
- Probe (`fe_work/help_probe.json`): clicking "How this page works" writes the modal first from `043_wave43`, then `060_wave60`, then `061_wave61`, and on some pages `065_wave65` or `085_wave85`. Only the last write is visible.
- Winners: `061` for requests, agendas, finances, volunteering, activity, importantinfo, orgchart, overview; `085` for goals, training, mypage; `065` for transcripts.
- Keep one help registry holding the winning text per page and delete the losing layers (`WA43_HELP` bodies, the wave60 visual versions that wave61 overrides). `060` and `061` also carry identical copies of `mTask`, `mPills`, `mCal`, `flow`, `mPeople`.

### 2.6 UI kept behind "classic" switches [DECISION: needs the owner]
| Switch | What it keeps alive | Cost today |
|---|---|---|
| `localStorage.wa114classic` (link on Home) | the pre-brand look; waves 117 and 118 skip themselves; the Inter and Public Sans fonts | old skins (waves 34, 35, 97) stay loaded and are overridden |
| `localStorage.w122classic` ("Classic view" on Training) | the Training page of waves 36, 37, 44, 45, 57 and 58 | still rendered while hidden: a 39 KB card inside `#training` next to the academy, and `043_wave43` alone writes 137 times into the page on each visit |
| `body.w131classic` ("Open the classic view" in Admin) | `#w113card` (wave113 people table), `#w113card + .card` (roles table), `#w127card` | still rendered while hidden: 89 KB and 52 KB of DOM in Admin, and `115_wave115` writes 156 times into the hidden table on every Admin visit |
| wave133 `oldCard()` | the wave11 roster card on the org chart | rendered and hidden with `.w133old`, used only if the chart fails to load |

Retiring each switch unlocks large deletions. Keep the org chart fallback or replace it with a plain error message.

### 2.7 CSS [OBVIOUS for the listed selectors, DECISION for the rest]
- 140 `<style>` elements exist at runtime (2 in the head markup, the rest injected by waves; 51 have no id), with 5,729 rules, 6,531 selectors and 236 `!important`.
- A full crawl as admin, member and board matched 3,035 selectors (46%). Most of the rest belong to states the crawl did not open (sheets, editors, errors), so they are not proven dead.
- Proven dead (no code anywhere produces the class): `.wn-list .wn-item .wn-dept` (base, pre-wave2 What's new), `.mp-member` (wave9), `.gl-card .gl-grid .gl-dept` (wave15 and wave35), `.w94empty`, `.wm`, `.w111h`, `.wa24-hero`, `.w112st` (in `#wa97css`), `.w116sec`, `.slk` (116q), `.w57cnt`, `.w116pick`.
- 152 unconditional `display:none` rules, 46 of them `!important`. The ones that hide whole features: `#board.panel ... #progdev.panel` (116i), `#whatsNew` (116g), `#needsMeBtn` (116), `#orgchart .card.w133old` (133), `#overview.w128on #w35stats`, `> .card.w28my`, `[data-w111f="aging"]` (128), the classic Admin cards (131), `.wa-header` (114, inside `#wa97css`), `.wa-dd` (13), `a[href*="clickup.com"]` (72).

---

## 3. Repetition

### 3.1 Helpers re-implemented per wave [OBVIOUS: safe to do now, in small steps]
Counts from `fe_work/families.js` and `dups.js` (definitions by body and by name):

| Family | Definitions | Segments | Notes |
|---|---|---|---|
| Role checks (`staff`, `staffOk`, `isAdmin`, `board`, `boardMode`, `role`, `tabOk`, ...) | 69 | 31 | `function staff(){ return typeof isStaff === 'function' && isStaff(); }` is copied into 21 segments under three names |
| Date helpers (`ymd`, `today`, `fmtDay`, `fmtDate`, `ago`, `addDays`, `parseDay`, fiscal year start, ...) | 86 | 39 | fiscal year start alone: 9 versions |
| Members and "me" (`lower`, `myEmail`, `members`, `who0`, `mePerson`) | 85 | 34 | `lower` is defined 27 times |
| Team label or colour | 48 | 32 | on top of `DEPT_LABEL`, `DEPT_COLOR`, `WA_TEAMS.labels` |
| Escape (`esc`, `escapeHtml`, `E`, `asEsc`, `esc31`, `w65Esc`, ...) | 45 | 40 | 17 full copies with different quote handling, 28 wrappers around `esc` |
| Toasts (`toastS` wrappers, two snackbars in 132 and 133) | 25 | 23 | the base `toast()` has 487 call sites |
| Avatars and initials | 23 | 18 | `w116Avatar`, `avatarHtml`, `initials` x7, `av` x7 |
| Sheets and drawers | 12 implementations | 12 | about 95 KB of CSS for `#w116dr`, `#w118cdr`, `#w121dr`, `#w122sheet` ... `#w133sheet` |
| Edge function wrappers (`fn`, `call`, `invoke`, `rpc`) | 18 | 16 | `fn(name, body)` is identical in 116l, 116n, 116p, 116q |
| localStorage wrappers | 14 | 7 | |
| Icon sets | 11 maps, 24 KB | 11 | `check` drawn 10 times, `x` 9 times |

99 groups of function bodies are identical once whitespace and comments are removed (36 KB). Two examples: `wa42Group` (`042`) and `w73Group` (`073`) are the same 784-byte function; `logChange` is copied in 127 and 131.

CSS repeats in the same way. Byte-identical declaration blocks are few (20 blocks in 3 or more segments, about 6 KB, `fe_work/out_css_repeated_blocks.txt`), but every wave restyles the same components under its own prefix: card styles under 13 prefixes (`.w116card`, `.w122card`, `.w126card` ...), chips under 13, buttons under 12, sheets under 11, page tops under 10. Base components are also restyled in layers: `select` and `#waChatBtn` in 5 style elements, `.tab`, `.card`, `.btn`, `main`, `textarea` and `nav.wa-nav` in 4 (base, 34, 35, 97).

Suggested shared kit (one new early segment, for example `002a_kit.seg`, exposing `window.WA`): `WA.esc`, `WA.role()` family, `WA.date`, `WA.team.label/color`, `WA.toast`, `WA.avatar`, `WA.sheet`, `WA.icon`, `WA.fn/rpc`, `WA.store`, `WA.brand` (the palette is re-declared in 38 segments and the font stacks in 34). Migrate wave by wave; each step is DOM-identical.

### 3.2 Hard-coded people lists [DECISION: needs the owner]
- A `FOUNDERS` list of three email addresses is copied into 8 segments (072, 080, 116l, 116n, 116p, 116r, 127, 131); 116o has a by-name variant.
- An admin list of six email prefixes is copied in `062_wave62.seg:33` and `065_wave65.seg:70`, and used as a fallback admin check.
- `116g_wave116g` hard-codes the executives and which executive owns each area; `075_wave75` has its own two-name list.
- These duplicate `hub_roles` and the access profiles. Move them to the database (or at least to one constant) so a staff change is one edit.

### 3.3 Data loading [OBVIOUS quick wins, DECISION for a data layer]
- Static: 530 literal `db.from` calls over 97 tables (full table by segment matrix: `fe_work/out_db_by_table_segment.txt`). `change_log` is inserted into from 32 segments (44 call sites), `team_members` is read in 17 segments, `dept_tasks` is used in 16, `volunteer_events` in 10, `dept_requests` in 9, `projects` in 8.
- Runtime, admin boot on the Home page (`fe_work/probe_staff.json`): 104 `db.from` calls to 52 tables, plus 5 RPCs and 1 edge function.

| Table | Loads at boot | Callers |
|---|---|---|
| `team_members` | 18 | `loadAll`, `waResolveMe` (009), `waLoadLeaders` x8 (006), `load` x2 (115), `wa28Load` (028), `w112Load`, `loadNews` (116g), 3 in 105 |
| `user_state` | 6 | `loadLastSeen`, `markSeen` (000), `waLoadPresence` x3, `waHeartbeat` (012) |
| `dept_tasks` | 5 | `loadAll`, `wa27Load`, `wa28Load`, `wa35Stats` x2 |
| `change_log` | 5 | `loadAll`, wave86 x4 |
| `slack_hours`, `dept_requests`, `hub_settings`, `wa_policies`, `wa_policy_signoffs` | 3 each | |

- Each wave keeps its own copy of people: `DB_MEMBERS`, `WA28_PEOPLE`, `WA_LEADERS`, `WA_ME`, `W115.byId`, `members()` helpers.
- Quick wins: cache the in-flight promise in `waLoadLeaders`, `wa35Stats`, `waLoadPresence`, wave105 and wave86; read from `DB_MEMBERS` instead of reloading `team_members`.
- Larger step: one `WA.data` module with `get('team_members')` style cached loaders and a `refresh(table)` event, plus one `WA.log(entity, id, field, old, new)` for the 32 segments that write audit rows.

### 3.4 Page facts live in many registries [DECISION: needs the owner]
For one page the label, group, breadcrumb, help and access name are declared separately in:
1. the menu button text (base markup, `042` `wa42Label`, `073`, `116d` `ORDER`),
2. `WA_NAV.register` (13 calls),
3. `118_wave118` `MAST` (breadcrumb section, title, purpose; it says Requests is in "Strategy", the menu shows it at top level),
4. `110_wave110` `TAB_LABEL`,
5. `parts127/a_head.js` and `parts131/a_head.js` `LABEL`, `GROUPS`, `LOCK` (the release checklist tells you to edit both),
6. `122_wave122` `TOURS` and later tour patches in 124, 126, 127, 128, 129, 131, 132, 133,
7. help texts in 043, 060, 061, 065, 085,
8. build-time renames in `teams_remap.py`.
A single page registry (id, route, panel, label, group, order, gate, profile label, breadcrumb, help, tour key) would remove most of this.

---

## 4. Navigation: who builds the menu

### 4.1 History and final writers
- Base markup: `#tabBar` with 10 buttons (overview, dashboard, six teams, transcripts, activity).
- Buttons created later by: `001` (progdev), `004` (importantinfo), `005` (requests), `007` (agendas), `009` (mypage), `011` (orgchart), `015` (goals), `017` (create), `020` (volunteering), `036` (training), `040` (adminpanel), `042` (finances, through its `need()` helper), `WA_NAV.register` in `042` for 046 (hrcentre), 087 (brain), 116h (hubmail), 124 (calendar, fundevents), 126 (governance, committees), 118c (photos) and 132 (bank), `116d` (orggoals, projects, goalmap), `120` (socialstats), `121` (contentcal).
- Full rebuilds: `013_wave13` (Departments, Workspace, Records), `042_wave42` (Departments, Work, People, Archive), `073_wave73` (Departments, Meetings, People, More). Each dissolves the previous groups and moves the same buttons.
- Incremental: `116d` creates Strategy; `116` rebuilds every team row and its flyout from `WA_TEAMS` and adopts tools; `095` moves Important info and The Brain into More (and retries at 800 ms and 2,500 ms); placement functions in `116h`, `118c`, `120`, `121`, `124`, `126`, `132`.
- Look: `114_wave114` turns the top bar into the left sidebar with CSS only (`nav.wa-nav #tabBar ...`), after earlier bar styles in 13, 34, 35, 42, 97. `118` adds Admin sub-links. `127` flattens rows and hides empty groups by profile.
- Defenders: MutationObservers on `#tabBar` in `116` (`watchNav`, which re-runs `restructureNav` and `w116Strategy` when "a tool drifts out of its team menu"), `124` and `126` (`watchNav` re-running `placeTabs`), `127` (`watchRows`), `132` (re-running `placeTab`).
- Recorded with an instrumented DOM (`fe_work/nav_staff.json`): 150 insertions into the menu during one admin boot, from 24 segments.

### 4.2 Final structure (admin) and the segment that decides it
| Group | Items, in order | Group built by | Items placed by |
|---|---|---|---|
| top level | Home, Calendar, then the groups, Requests between Strategy and People | `073` order | `124` puts Calendar after Home |
| Departments | Operations Montreal, Program Development, Operations Toronto, Marketing, Branding & Web, Fundraising & Finances, Human Resources, Board & Governance; each row has Overview, Agenda, Tasks (Fundraising: Grants, Event fundraising, Donor relations, Finance, All tasks; Board: Board overview, Committees, Team page, Agenda, Tasks) | group `073`, rows and flyouts `116` (`WA_TEAMS.order`, `WA_TEAMS.pages`) | tools: `116` (MTL volunteering, Finances, HR centre), `120` (Analytics), `121` (Content calendar), `124` (Events calendar), `126` (Board overview, Committees) |
| Meetings | Transcript archive, Agendas, Hub inbox | `073` | `116h` (Hub inbox) |
| Strategy | Executive dashboard, Organizational goals, Department goals, Projects, Goal alignment, The bank | `116d` (`ORDER` list) | `132` (The bank, last) |
| People | Org chart, Training academy | `073` | `116` moved Volunteering and HR centre out |
| More | Activity, Admin, Important info, The Brain, Photo library | `073` | `095` (Important info, The Brain), `118c` (Photo library) |
| hidden | Dashboard, Create studio | hidden by `073` (`data-w73hide`), re-hidden on every `wa40Enforce` | |
| Admin sub-links (under the Admin tab, shown when Admin is open) | AI models, Adoption, Workspace accounts, People and access, Access profiles, Security and audit trail, Change the Hub | `118` (`.w118sub`, `#adminpanel/<section>`) | `131` hides Access profiles unless the classic view is on |

Role differences (fixture identities): a member loses Board & Governance (with Board overview and Committees), Agendas, Hub inbox, Activity, Admin, Finances and HR centre; the fixture leader loses Agendas, Admin and HR centre (HR centre also follows the HR access list). A board viewer gets no Home; `124` and `126` move Calendar, Events calendar, Board overview and Committees into Strategy after the Executive dashboard, and `127` flattens the Marketing row so Content calendar and Analytics show as plain items.

### 4.3 Where a new grouping should go [DECISION: needs the owner]
Today there is no single place. A new grouping done the usual way (one more rebuild) will be undone by the observers in 116, 124, 126 and 132. Least-risk plan:
1. Add `WA_NAV.layout` (groups, labels, ordered tab ids, and the board variant) and `WA_NAV.applyLayout()` that moves existing buttons (never recreates them, so handlers survive) and then calls `wa40Enforce()`. Put it in one new segment after `133_wave133` and before `110_wave110`, and run it from that segment's `startApp` wrapper (only 110 wraps later).
2. Make the four placement observers (116, 124, 126, 132) call `applyLayout()` instead of their own placement, and make `strategyGroup`, `w95Tidy` and the seven `placeTab` functions defer to it when `WA_NAV.layout` exists.
3. Update the other copies of the grouping: `118` `MAST` breadcrumbs, the chrome tour text in `122` ("grouped into Departments, Meetings, Strategy and People"), `TAB_LABEL` in 110, and the profile page `GROUPS` in parts127/parts131 (a different, access-only grouping; decide whether it should follow the menu).
4. Later, delete the group-building code in 013, 042 and 073.

---

## 5. Routing

- **Base**: `applyHash` (`000_head_base.seg:2271`) handles `dept/<d>`, `decisions`, `overview`, `needs-me`, `task/<id>`, `decision/<id>`, `tx/<id>`, `dashboard`, `transcripts`, `activity`; everything else falls back to overview.
- **Wrappers**: 21 more `applyHash` layers (004, 005, 007, 009, 011, 015, 017, 019, 020, 022, 027, 033, 036, 042, 078, 116i, 120, 121, 122, 123, 133). `042` adds the registry dispatch: if the first hash part matches `WA_NAV.pages[i].id`, it calls `showPanel(id)` and `onShow(hash)`.
- **Independent listeners**: 26 `hashchange` listeners (base plus 004, 005, 007, 009, 011, 015, 017, 019, 020, 022, 116, 120, 121, 122 x2, 123, 124, 126, 118, 118c, 127, 130, 131, 132, 133). Each reacts to its own hashes, outside `applyHash`.
- **Redirects inside `showPanel` wrappers (44 layers)**: `040` sends pages outside the role to overview (except needsme, personpage, projectpage, volunteering, importantinfo), `111` turns `dashboard` into overview plus the numbers fold, `116i` turns team ids into `#team/<id>`, `127` re-checks the profile.
- **Registry**: `WA_NAV.pages` holds 15 entries (adminpanel is pushed by hand in 042, and 118 re-adds it if missing; brain is there twice). Most pages are not in it; they rely on their own `applyHash` wrapper or listener.
- **Duplicate or overlapping routes**: `agendas` (007 and 019, both a wrapper and a listener), `needs-me`/`needsme` (base and 078, both now land on Home), `dept/` and `task/` (base and 116i), `mypage` (009 and 124 listeners), `create` (017 and 118c), `orgchart` (011 and 133), `socialstats` (120 wrapper and listener), `#team/fundraising` and `#team/board` (116, 124, 126).
- **Reachable only by hash or in-page links**: `#dashboard`, `#create`, `#needsme`, `#project/<id>` (panel `projectpage`), `#person/<name>` (panel `personpage`), `#confirm/<token>`, `#orgchart/<id>`, `#hrcentre/<tab>`, `#adminpanel/<section>`, `#training/...`, `#requests/...`, `#volunteering/e/<id>`, `#bank/<team>`, `#photos/<id>`. Route shapes per page are in `fe_pages.json`.
- **Id and route mismatches**: `project/<id>` shows `#projectpage`, `person/<x>` shows `#personpage`; `#projectpage` alone falls back.

---

## 6. Things that confuse developers and AI agents

1. **The source is not what ships [OBVIOUS]**: `brand_remap.py` rewrites 1,532 colour values in 122 segments and `teams_remap.py` 36 texts in 12 segments after assembly. For example the section titles and select options in `000_head_base` say "Fundraising &amp; Grants" in the source and "Fundraising &amp; Finances" in the build, so a search of `src/` misses them. Applying both scripts to the sources once gives a byte-identical `candidate.html` (verified per segment in `fe_work/segmap.py`); then drop the remap step. The parts folders need the same pass.
2. **Generator drift [OBVIOUS]**: `118_wave118.seg` was hand-edited in waves 132 and 133 (git history), but `w118_gen.py` was not. Re-running the generator silently reverts those edits. `w117_gen.py` is in sync (re-run in a sandbox, identical output). Declare the segment the source and archive `w118_gen.py`, or port the edits.
3. **MANIFEST order carries meaning that is written nowhere**: `001_wave116a` must run first, `116q` sits before `116p`, `119` to `126` sit before `117`, `118`, `118b`, `118c`, and `110_wave110` must be last (its `startApp` wrapper sets `html.wa-ready`). File names are wave numbers, not features. Add a short "why here" note per line (build.sh would need to skip `#` lines) or a table in the architecture guide [OBVIOUS].
4. **Script-scoped globals**: `db`, `USER`, `MODE`, `SESSION` and 32 other names are top-level `let`/`const`, so they are not on `window` (bug B2). 430 more top-level `var`/`function` names and 193 `window.X` names share one namespace, plus 122 `window.__waNN` run-once flags.
5. **Wrapper wars**: `127` re-wraps `wa40Allowed` and `wa40Enforce` whenever someone else wrapped them ("keep ours outermost"). `126` uses a window capture listener "that runs before wave116's". `116` re-asserts the menu when others move it. Behaviour depends on load order and timing.
6. **Silent failures**: 1,716 `try` blocks, 1,131 with an empty `catch`; 1,198 `typeof X === 'function'` guards. A typo or a private name (section B3) never shows up.
7. **Timing as sequencing**: 304 `setTimeout` calls with 54 different literal delays (60, 250, 150, 300, 380, 400, 800, 900, 1,500, 2,500 ms ...), used to wait for other waves to render. Five `setInterval` timers run for the whole session (two 60 s timers in `116j`, 3 min presence in `012`, 30 s usage in `093`, 60 s in `118b`), plus the veil's fact rotation, which stops after boot.
8. **Ids do not match labels**: `overview` is "Executive dashboard", `goals` is "Department goals", `mypage` is "Home", `training` is "Training academy", `board` is "Board & Governance", `dashboard` is merged into overview, `create` is hidden. Record the mapping in the page registry.
9. **Hidden panels used as templates**: `111_wave111` clones the hidden `#dashboard` panel's children; deleting "dead" UI needs this checked first.
10. **Magic ids and numbers**: `WA_TEAMS.boardProjects` hard-codes project ids (`001_wave116a`); the 9 s veil failsafe; the 40, 42 and 21 day windows and the 300 row limit in `loadAll`.
11. **Storage keys**: 58 keys used in one admin session, in five naming styles (`wa84tour`, `wa116.projects`, `w118bSeen`, `wa116r_visit`, `w130pol:<email>`); `w130pol:<email>` was read 153 times during one crawl. 35 of the keys (`wa77.*`) serve the hidden classic panels.
12. **Global listeners**: 107 click listeners on `document` or `document.body` (24 of them in the capture phase, some calling `stopImmediatePropagation`) and 26 on `document` for `change`. Every click runs all of them.
13. **Tests are not reproducible outside this machine [OBVIOUS]**: 9 test scripts (including `w130drive.js` to `w133drive.js`) read `fixture_live.json` from a session scratchpad path; several tests hard-code real staff emails. Commit an anonymised fixture next to `test/fixture.json`.
14. **Edge functions without source in the repo**: the page invokes 33 edge functions by name; 8 of them (`agenda-share`, `finance-import`, `hours-pull`, `hub-edit`, `inventory-share`, `notify`, `quo-pull`, `slack-pull`) have no folder in `fn/`, so an agent cannot read what they do [OBVIOUS: pull them into `fn/`].
15. **Shared caches written by several waves**: `DB_TASKS` is reassigned by 000, 062, 116b and 132; `AGENDAS_CACHE` by 006, 007 and 053; `WA_VOL_LOADED` by five segments; `WA40_MINE` by 040 and 072 (25 such globals, `fe_work` scope analysis). `062_wave62` also filters `DB_TASKS`, `DB_UPDATES` and `DB_DECISIONS` in the browser for confidential meetings ("client-side gating until RLS phase 2"); confirm the database now enforces this [DECISION].
16. **Console**: quiet. One warning at runtime (cytoscape `wheelSensitivity`), 26 `console.warn` calls in error paths. Nothing to fix beyond the cytoscape option.

---

## 7. Suggested order of work

1. B1, B2, B3, B4 (bugs, each a few lines).
2. Bake the remaps into the sources; settle the w118 generator; document MANIFEST order (items 6.1 to 6.3).
3. Remove the dead code in 2.1 to 2.5 and the proven-dead CSS (DOM-identical harness runs should stay green).
4. Add the shared kit (3.1) and migrate helpers wave by wave; add in-flight promise caching (3.3).
5. Owner decisions: stop rendering the classic panels (1.1), retire the classic switches (2.6), one page registry (3.4), one menu layout (4.3), people lists to the database (3.2).
6. Then the structural work: replace `startApp`/`showPanel`/`applyHash` wrapping with registered hooks (`WA.onBoot`, `WA.onPage(id)`, `WA.route(pattern)`), which also opens the door to lazy loading.

---

## Appendix: reading `fe_pages.json`

An array with one entry per page or route (42 entries: every menu page, each team id, the hidden tabs, and the routes with no menu entry such as `#project/<id>`, `#person/<name>`, `#task/<id>`, `#confirm/<token>`). Fields:
- `route`, `panel`: the hash shape (with sub-routes) and the DOM panel that shows it.
- `nav_label`, `nav_group`, `nav_placed_by`: the admin menu as rendered, and the segment that creates or places the button.
- `access_gate`: a one-line summary; `access` has the details: lowest role in `WA40_DEFAULTS`, the `WA_NAV.register` gate, the wave40 exemptions, allowed and in-menu per fixture identity (admin, leader, member, board viewer), the profile decisions in the local fixture snapshot (may differ from live), and the database lock noted in `parts131/a_head.js`.
- `segments.render_on_open`: segments whose code wrote into the page when it was opened (runtime, admin). `page_chrome_on_open`: the cross-cutting masthead and help writers (118, 043). `routing`: segments whose `applyHash` wrapper, `hashchange` listener, `showPanel` wrapper or `WA_NAV.register` names the page. `static_references`: `segment:count` of references to the id in the source.
- `reads.on_open`: tables, RPCs and edge functions called while opening the page after boot, with the calling segment. `reads.at_boot`: what the page relies on from boot-time loads. `reads.referenced_by_render_segments`: every table (with operations), RPC and edge function that the render segments use anywhere, so it includes actions, not only reads.
- `tour`, `help_popup_writers` (in write order; the last one is what people see), `notes`.
