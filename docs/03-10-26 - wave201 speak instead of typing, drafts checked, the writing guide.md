# 03/10/26 - wave201: speak instead of typing in every AI prompt box; Your inbox's drafts checked in Gmail; the writing guide

Live md5 `d0612620de933dde9d58aa77243337c5` (6,071,197 bytes), deployed through the gated pipeline on top of wave200's `e67d6f3b37053e70e1724b1f28f39fbb` (host-sync `ok`, Netlify deploy accepted; change_log release line `wave201`). Function: mybox v1.4 (platform version 5). Migration: `wa201_voice_drafts` (comments and the Academy's Hub modules 1 and 8; no schema change). Numbered 201: wave 200 is the parallel session's (the team board and Add people).

## What Steel asked

- On Your inbox's reply tool (screenshot of the Kathryn Westoll e-introduction): "I'd like to use voice to text in prompts here". Asked where, he chose **every AI prompt box**.
- Then: "also can we make sure /steel-writing:wa-writing skill is used as a framework to writing emails. Could you also make sure that drafts are actually saved. It didn't work last time".
- On the writing guide (after two database approval prompts came back cancelled): "I want this guide to help the AI responses sound like me when I ask it to help me reply".

## What was found about the drafts

The last save from the Hub (02/10/26 15:19 UTC, the reply to Lily on the Keela/Aplos ticket) did create the Gmail draft (`r5455873991214111603`, thread `1a0e3b9746772700`, read back through the Gmail connector on 03/10/26: the full text, unsent, in his Welfare Avenue drafts). Two things made it look like it had not worked:

1. The Hub's links to Gmail were `mail.google.com/mail/u/<encoded address>/...`, which can open whichever Google account the browser has first (his personal Gmail), where there is no draft.
2. The [brackets] check stopped the first press of Save and put its note under the buttons, so a press could look like it did nothing.

## What changed for people

**Speak instead of typing.** One shared mic, the same everywhere (`build/parts201/a_mic.js`, segment `201_wave201`): tap it, talk, and the words appear in the box as you speak; tap again or press Esc to stop (Esc does not close the inbox or a dialog). It listens in the person's Hub language (wave198: Francais is `fr-CA`, else `en-CA`), with the browser's own SpeechRecognition (Chrome, Edge, Safari; not Firefox, where no mic shows). The mic sits inside the box's corner (clear of the resize grip) or, in a row such as Ask the Hub's, beside it; the box keeps its place (a zero-height holder under it, no timers). Words go in at the caret, the first word capitalised at the start of a sentence; every change fires the box's input event, so the page keeps what was said as if it were typed. A page that redraws the box mid-sentence (Your inbox does on every tap) is followed: the box is found again by its key. A box that is gone or hidden for 1.5 s stops the listening. The boxes (`TARGETS`): Ask the Hub (`#w38in`, which lost wave14's mic when wave38 replaced its row), Your inbox (own words, anything else to say, the reply, the team's line, the writing guide), the content drafter's brief (`#cdBrief`), Suggest a change (`#w96in`, `#w96rin`), Finance's import guidance (`#w90gtext`), the agenda's purpose (`#w53purpose`) and the grant writer's notes (`data-w193wnotes`). The Loop (`#w192say`) keeps its own Speak button.

**Your inbox: drafts checked.** Save as a Gmail draft now reads the draft back from Gmail (it must be a draft, in the email's thread) before the Hub says Saved; saving again for the same email updates that draft instead of adding a second one; the saved card says "The Hub read it back from Gmail: it is there, in <his address>" and **Open the draft in Gmail** opens that draft itself, in his account (`?authuser=<address>#all?compose=thread-f:<thread id in decimal>%2Bmsg-a:<draft id>`, the same link Google gives for a draft; checked against the 02/10 draft). Open in Gmail and All your drafts name his account too. The [brackets] note sits right above the button, which then reads **Save it with the [brackets]**. change_log gets `draft saved` or `draft updated` with the ids only.

**Your inbox: wa-writing as the framework.** The owner's writing guide (`mybox_owners.voice`) goes first in every draft, labelled as the framework; the model first picks the reader in wa-writing's audiences (board member, funder or donor, staff or volunteer, close collaborator, partner or community organisation, first contact, vendor or support desk) and the register (standard email, quick reply, closure reply, hard news), and the draft shows "Written with wa-writing. Reader: ... Register: ...". Figures come only from the owner, the thread, or the Hub's verified fact base (`fund_facts` status verified, budgets left out), which is wa-writing's facts rule in the Hub. A draft that still carries a phrase the guide bans (stock openers and closers, corporate filler, "I just wanted to", charity boilerplate, "whilst", "&" in prose) is revised once; anything left is named in Before you send.

**Settings, Your writing guide.** The owner reads and edits their guide in the Hub (the function's `voice` and `settings {voice}`; only they can; change_log gets its length and framework, never its text). The Hub shows its framework from the first line `FRAMEWORK: <name>`. This also makes a rollout to someone else self-serve.

## Steel's guide (not in the repo)

The guide written from `/steel-writing:wa-writing` (leading) and `/steel-writing:steel-voice` (underneath), for email: hard rules (no em dashes; figures only from Steel, the thread or the verified facts; blame unnamed, credit named; nothing about his role or transition beyond the email; sensitive findings never to a group or third party; plain text; the sender's language, Quebec French with vous), the readers (wa-writing's audience calibration, plus first contact and vendor or support desk from steel-voice), how he writes, the shape of a reply, his moves, the register dial, the never list, the example anchor and the final check. It was not saved: both database prompts that would have written it came back cancelled. Per the standing rule it lives in his row only, so it goes in through Settings, Your writing guide (Steel pastes it, or the assistant does it in his signed-in Hub with his OK). Until then his drafts use the earlier condensed guide (also wa-writing and steel-voice) with the new framework steps around it.

## Releases

- mybox v1.4, platform version 5 (deployed through the MCP; the vault's SUPABASE_ACCESS_TOKEN still answers 401, so fn-deploy is out). The repo's `fn/mybox/index.ts` is the deployed source byte for byte (md5 `e775b7841751d7959755d5806cc5ee3b`).
- Migration `wa201_voice_drafts`: comments on `mybox_owners.voice`, `mybox_mail.draft_id`, `mybox_mail.drafted_at`; Hub module 1 (id 39: the writing guide, the checked draft, the mic) and Hub module 8 (id 46: Speak instead of typing).
- The page: parts170 (a_head: `au`, `gmailUrl` by authuser, `draftsUrl`, `draftUrl`; the warn, framework and guide styles; d_sheet: the drafted notice, the framework line, the warning and error above the buttons, the saved card, `guideHtml` and `loadGuide`; z_wire: `saveDraft` with the warning and `showActs`, `saveGuide`, the guide's input and summary), and parts201 (new). MANIFEST: `201_wave201` after `199_wave199`.

## Tests

- `test/w201drive.js` 39 of 39: the mic on the inbox's boxes (inside the box), listening in English, words as they come, finished words kept, stop, a redraw mid-sentence followed, Esc stops and leaves the inbox open, what was said is what the draft call sends, the framework line, the mic on the reply, speaking at the caret, the [brackets] note above the button and the button's label, the save, the read-back message, the draft link and All your drafts, an earlier draft opening with Google's own link, Settings: the guide read through mybox, shown with its framework, a mic, saved through settings; Ask the Hub's mic beside the box and filling the question; every other box getting a mic, The Loop not getting a second one, no layout shift, a removed box stopping the listening, a refused microphone; a phone (390 px), French (`fr-CA`), and no mic at all without SpeechRecognition.
- `test/w170drive.js` 64 of 65 on the new build, as on the live build (5.4 fails on both: the live roster changed); its link, notice and saved-wording checks were updated to wave201.
- Same results on the new build and the live build: w192drive 79, w193drive 44, w198drive 20, w134drive 34, w200drive 48 of 49 (one failing on both); 34 of the 42 page tours compared identical before the run was cut off (the other 8 are pages this wave does not touch).
- Security advisor: no new finding; the two ERRORs are older (the `volunteer_people` view, and two other sessions' temporary tables with RLS off).

## For Steel

1. Put your writing guide in: Your inbox, Settings, Your writing guide (or say the word and the assistant pastes it in your signed-in Hub).
2. Try the mic once on the Kathryn reply: tap it, say your answer, tap again. The browser asks once for the microphone.
3. Your 2 Oct reply to Lily (Keela/Aplos ticket) is still sitting unsent in your Welfare Avenue Gmail drafts.
4. Approve the cleanup statement when asked (this session's temporary tables), or paste it in the Supabase SQL editor.
