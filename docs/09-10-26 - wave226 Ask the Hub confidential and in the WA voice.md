# 09/10/26 - wave226: Ask the Hub keeps confidences, and speaks Welfare Avenue

Steel (09/10/26): confidential information, "especially board meetings and my departure", must never be found in Ask the Hub or anywhere in the Hub ("I can ask, is Steel leaving, to Ask the Hub and it will tell them"); tasks from confidential meetings still get made but "keep it high level, surface level". And Ask the Hub should answer in the Welfare Avenue voice (his wa-writing skill): concise, to the point, friendly, with WA's branded Slack emojis, hyperlinks instead of full addresses, and a nicer look.

His choices: no exceptions (everyone, Steel, Suhaib and the board included); off-limits are leadership changes, HR people matters, one-on-ones and leaders-only meetings, and board documents in Drive (as well as board meetings and his departure); WA brand emojis, light touch.

Numbered 226: a parallel session shipped wave221 (the Hub, not "AI") the same night, and 222 to 225 are taken (wa225_studio).

## Ask the Hub (edge function ask, v15 to v15c, platform version 26)

1. **The question.** An off-limits question gets the same reply every time, before any data is read or any model is called, so the answer never confirms or denies anything: "That one's not something I can share here ... If it's something you need, the right person will bring it to you directly." (`CONF_ANSWER`, `confidential: true` in the response.)
2. **The context.** Whoever asks, it never holds: one-on-ones, leaders-only, confidential or board-only meetings, or the Board team's (`confMeeting`); board-only, confidential or restricted tasks, decisions and banked work; time-off requests; the Board team's state; leadership story rows and documents (`wa_story_context` with lead off); Drive files whose names say board, minutes, governance, HR, contract, interview and the like (`CONF_DOC_NAME`), or that the Document finder keeps for leaders; board and executive roles in the team list.
3. **The words.** Every sentence left in the context that touches an off-limits topic loses that clause (`CONF` patterns: leadership changes, board matters, HR people matters, "confidential").
4. **The answer.** Checked a line at a time before it leaves; a sentence that touches an off-limits topic goes, and an answer with nothing left becomes the standard reply. The chat history sent back is filtered the same way.

The voice: concise (40 to 90 words), lead with the answer, first names, no em dashes, light Markdown (a short bold phrase, "- " lists of at most five, [label](link) links, never a bare address), at most two of WA's Slack emojis, no internal ids (the function also strips "(task 646)" and bare addresses become "the doc", "the Loom").

Live checks (trigger secret path, 09/10/26): "Is Steel leaving?", "Who is going to replace Steel as ED?", "What did the board decide in July?", "Is Suhaib stepping down?" get the standard reply; "What happened at the fundraising meeting on August 18?" answers without the departure in that meeting's summary; "What did HR talk about recently?" answers about recruitment only; the Rally Paper answer lists the work with owners and labelled links.

## The page (build/src/226_wave226.seg)

Light Markdown made safe (escaped first; links only https, mailto or a Hub #page; a Hub page link closes the drawer on a phone), our Slack emojis drawn from the brand kit (:wa-heart-gold:, :wa-heart-beat: beats, :wa-star-pop: pops, :wa-arrow-go: nudges, :wa-e-moves: moves its bars; still when motion is off; an unknown one is left out), sources as chips, the confidential reply in a soft purple card, a friendlier error line, the welcome in the WA voice, answers marked data-w198skip. Wired by a MutationObserver on #wacMsgs; wave38's send path untouched. `test/w226drive.js` 28 checks (desktop and phone).

## The Hub's writing jobs (llm v1.6, platform version 14)

`ai_routes.system_add` (migration wa226_route_system_add): text the router adds to the end of the system prompt of every call on that route. Meant for the confidentiality rule on the routes whose words the team reads (transcript_extract, leadership, transcript_archive, transcript_preview, digest, profile, shoutout, draft, reel, checkin, decision, goals, brain_suggest, reason, content_ideas): the work from a sensitive conversation is written as the work itself ("Prepare role handover notes for Fundraising"), never the person's situation or the reason. The board_sensitive and confidential flags work as before.

**Waiting for Steel:** the rule's values and the rewording of existing rows (build/data/wa226_confidential.sql, parts 1 and 2) were held by the Supabase connector for an approval that never reached him (three timeouts). He runs them in the SQL editor (the file "09-10-26 - Hub confidentiality, SQL to run.sql"). Until then the router has the column but no rule, so the writing jobs behave as before.

The rewording: the HR page's read and progress, dept_updates 181 and 182, dept_tasks 15, 520, 561 and 563, task_comments 93, 137, 141 and 142, the summary of transcript 255 (it named the transition and "potentially until 2027"), change_log 5225. Meeting recordings (transcripts.body) are not changed.

## Left as is, for Steel to decide

- The archive keeps the AI summaries of his one-on-ones with Suhaib (218, 228; only the two of them can open those) and leaders-only meetings that mention succession (177, 195, 197, 210, 237; leaders only). Ask the Hub never reads them; locking them to Steel alone is one statement if he wants it.
- The roster's role for Steel reads "Founder, Co-ED, Board President" (the org chart shows roles).
- Ask the Hub's route (brain) lets Jev pick the model; it picks GPT-5 mini (about half a cent a question). Sonnet follows the voice more closely at about ten times the cost.

## Release

Live md5 745f8371f0fb68d43bddec8d056b4bc9 (on caf564fa, a parallel session's build after wave221's da973901), gated deploy (`wa_stage_226b`), host-sync. ask v26, llm v14. Temporary objects closed to the API (wa_stage_226, wa_stage_226b, wa_tmp221_pull, wa_tmp221_call_edge_long, wa_tmp221_scan); the hourly sweep drops them. build/candidate.html not pushed: the release was the live build with this segment added after 221_wave221.
