# 26/09/26 - wave136: content ideas from marketing meetings

Live md5 `6e207481a8c912d4432ddf1c6e411528` (3,845,995 bytes), deployed through the gated pipeline (`wa_stage_rg`, guarded on the live md5 `df09bb9b` and dropped after). Schema: `wa136_content_ideas`. Edge functions: process-transcript v14, transcript-preview v6.

## What Steel asked

"Alot of great content ideas come out of our marketing meetings. I'd like to keep those either in the bank or in the ideas section of the content calendar"

## What it does

**Every Marketing meeting** now gets a second read, after the board update: the Hub goes through the whole meeting (not only its first 30,000 characters, as the board pass does) and picks out the ideas for posts, reels, carousels, stories and series that people raised, even when nobody committed to making them yet. Each idea keeps:

- a short working title, what it is and what it needs, and the format if one was named;
- who raised it (a roster name when the Hub is sure), the campaign it belongs to, and the date, event or season it is for;
- the meeting it came from.

Each idea must come with an exact quote from the meeting; an idea whose quote is not in the transcript is dropped, so nothing is invented. An idea already in the calendar (same title) is not added twice, and an idea whose moment has passed is left out.

**Where they go:**

- Into the **Content calendar's Ideas** (drafts without a date), with a line saying where each came from ("For Nov 9 · From Marketing Meeting - August 12, 2026"). The week at a glance counts them.
- An idea for **three months or more away** goes to **the bank** instead, and comes back to the Ideas six weeks before its date, so the team has time to make it. The tray says how many ideas wait in the bank, with a link to them.

**In the Content calendar:** opening an idea shows where it came from, who raised it and what it is for, with **Open the meeting**. Any undated idea can go to the bank from its composer (**Put in the bank**, with a day and a reason; an Undo follows).

**On the bank page:** content ideas are listed with the rest of the work that waits (tagged Content idea, under Marketing), with **Bring back now** and **New date**; the counts and How the bank works include them, and the Marketing team page's bank card lists them.

**The upload preview** of a Marketing meeting lists the content ideas it will add, and says which one will wait in the bank.

**The Slack line** that already goes out after a meeting is processed counts them ("3 content ideas for the calendar (1 in the bank)"). No new Slack message.

## How it works underneath

- `content_posts` gains `source_transcript_id` (a foreign key to the meeting), `suggested_by`, `idea_for` and the bank columns (`banked_at`, `bank_until`, `bank_note`, `banked_by`, `resurfaced_at`), with a CHECK that only an undated draft can be in the bank.
- `content_ideas_from_meeting()` (service role only) files the ideas the pipeline found: it refuses board-only, leadership and private meetings, skips duplicates and past dates, banks the far ones and logs the result.
- `bank_idea()` puts an idea in the bank by hand (staff who can bank). The bank functions (`bank_list`, `bank_unbank`, `bank_redate`, `bank_undo`, `bank_resurface` and `bank_unbank_do`) take a third kind, `idea`; the daily job brings ideas back on their date.
- process-transcript v14 runs the ideas pass through the model router (new route `content_ideas`: Sonnet 5, then GPT-5, then Sonnet 4.5, shown in Admin > AI models). The pass never blocks the board update. `{action: 'ideas', transcript_id}` runs only this pass for a meeting uploaded before today (no Slack); `dry_run` returns what it would add.

## Release checklist

- **Access:** no page changed hands. The Content calendar and the bank page keep their access; banking an idea needs the same right as banking a task (`wa_can_bank()`).
- **Training:** the Content calendar tour's Ideas step and the bank tour's How it works step say where meeting ideas go; Hub module 3 (uploading a meeting transcript) says so too; the bank page's How the bank works has a paragraph on content ideas.
- **Security review:** the new pipeline function is for the service role only, `bank_idea()` checks inside, neither is open to anonymous callers, and the advisor shows no ERROR.

## Verification

- The migration ran first as a rolled-back dry run: two ideas filed from the August 12 meeting (one banked until six weeks before its date), a duplicate, a past idea and an untitled one skipped, a board-only meeting refused; `bank_list` shows the idea with its meeting; banking by hand, a new date, Undo, Bring back now and the daily job all work; the CHECK blocks scheduling a banked idea; an outside account is refused.
- The ideas pass, dry run on the August 12 marketing meeting: 12 ideas, every one with a quote found in the transcript.
- `test/w136drive.js` 16 of 16 (the tray, the glance, the composer's source line, Put in the bank and Undo, the bank page, the upload preview, no page errors). Regression: w132 (52, and 51 as a member at phone width), w134 37 of 37, w122 36 of 36 with every tour to the end; the harness for three identities differs from the live build only on the Content calendar and the bank page; no repaint loops on the changed pages.
- Live: the md5 matches the build.

## For Steel

- Past marketing meetings: the Hub can read the meetings uploaded before today for their ideas too (ideas tied to dates that have passed are left out). Say the word and how far back.
