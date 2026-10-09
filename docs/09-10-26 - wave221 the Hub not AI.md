# 09/10/26 - wave221: the Hub speaks as "the Hub", not "AI"

Steel (09/10/26): "I'd rather not say AI and use another word ... I'd rather it be more personable rather than AI anywhere in the hub. I just saw it in the comments under meeting AI." His choices: "the Hub" (as in Ask the Hub); everywhere but the Admin centre ("not the admin panel but everywhere else").

## What changed

- **The words:** 87 places across 30 segments (pages, buttons, toasts, help text, page tours): "The AI suggests" is "The Hub suggests", "Edit with AI" style buttons say "with the Hub", "AI recommendation" is "the Hub's recommendation", the photo library's labels come "from the Hub", the email studio's cost notes speak of "the Hub's writing help". Segments built from parts (118c, 122, 123, 202) were changed in their parts too; their assemblers were not re-run (122, 123 and 202 had drifted from their parts before this wave).
- **Who did something:** the database keeps its markers ("AI: <meeting>" in updated_by, added_by, raised_by and changed_by; wa209_task_link and others match them). The pages show them through `window.waWho()` (221_wave221.seg): "the Hub, from <meeting>". Used in the task drawer (last change by, activity), decisions (raised by), goals (updated by), requests (from, the timeline and activity).
- **Comment authors:** 239 task comments signed "Meeting AI" or "Slack AI" now read "The Hub, from the meeting" and "The Hub, from Slack"; `trg_wa221_comment_author` signs new ones the same way whatever the edge functions send.
- **Requests from a meeting:** "Meeting AI (accepted by X)" is now "X (from a meeting)" in the data (8 requests, 4 log lines) and in what the pages write.
- **Academy:** Hub modules 2, 3, 4 and 8 (trainings 40, 41, 42, 46), wording only (updated_at kept).

## Kept

- The Admin centre: AI models, Adoption (AI spend, AI calls), Change the Hub (Edit with AI), the Activity log, the admin role and profile notes, the Settings spend-cap note.
- What people typed or the meeting summaries say (a meeting about AI still says AI).
- The Rally Paper SOP's "no AI tools" (a rule of the game).
- Slack posts and emails sent by edge functions (outside the Hub's pages).
- French: the new English words are translated by the nightly i18n-translate; until then French readers see them in English.

## Tests

- `test/w221drive.js` 9 checks: waWho's mappings, and 25 Hub pages walked as an admin and as a member with no "AI" on screen (fixture meeting text excepted), no page errors.
- Regression on the build: w220 21, w213 21, w219 82. The comment trigger checked in a rolled-back insert.

## Release

Live md5 da9739017e81cec5b9111e4bc088a8fe (on wave220's 36de481d). Migration wa221_the_hub_words.
