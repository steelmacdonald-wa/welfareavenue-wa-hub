# 15/10/26 - wave243: the Content Studio in the Avenue Academy, and a task's assignee

Steel, 15/10/26: "Content Studio path in the Academy (academy_assign, kept current, no overlaps)" and "process-transcript
v18.2: empty assignees to [owner]". Live 15/10/26 about 15:30 Toronto.

## The Learning Avenue "The Content Studio" (build/data/wa243_studio_academy.py, .sql; migration wa243_studio_academy)
- `academy_paths` key `studio`: name and title "The Content Studio", marketing, not required, certificate "Content Studio
  Ready", purple, icon spark, sort 46 (after Campaigns and storytelling).
- One lesson, `trainings` key `lesson:studio` (id 242, category Marketing, 14 minutes, 40 XP): How the Content Studio
  works, in ten chapters: what the Studio is (who publishes, the six parts as cards); Overview, the calendar and the
  queue; the composer (captions per platform, media, tracked links, first comment, the Canva design, the partner, the
  LinkedIn article, templates and repeats); scheduling goes to approval (the four steps, Ian and KK, nothing posts
  unapproved); how a post goes out (direct per platform, the reminder flow, the confirmations); comments; the Library,
  links and analytics; content for each serving (wave240); what reaches you and where (wave242); your first post. Then a
  knowledge check of seven questions (pass 0.8).
- No overlap with what the Academy already holds: the page tour (trainings tour:contentstudio, Hub page tours) and
  Marketing basics' two reads on posting stay where they are; the lesson points to them.
- The assignment (`academy_assignments` id 4): the path to the marketing team, people who join later included
  (include_new: the daily cron wa-academy-assign gives it to them), due in three weeks (05/11/26), assigned by "the Hub".
  `academy_assign_apply` made nine training_progress rows (Alejandra, Edison, Eduardo, Ian, Joy, Kahkashan, Patricia,
  Roberto, Soraya). No Slack message: an assignment shows in the Hub (My page, the Academy).
- The migration is re-runnable: the path and the lesson upsert on their keys; the assignment is made only when no active
  one for the path exists.

## process-transcript v18.2 (platform 28)
- After the names are canonised, a new task with no assignee named gets its owner as assignee when the owner is a roster
  name (assignees = [owner]), so apply_transcript_result writes the task_assignees row and the task shows on the owner's
  My page and in their task reminders (wave242). A non-roster owner (Both, a garbled name) is left alone, so the
  "(verify name)" flag is never added by this rule.
- The tasks the 14/10 marketing meeting filed before v18.2 keep working through the owner name (My page and the
  reminders both match the owner); nothing was backfilled.

## Tests
- test/w243drive.js 18 of 18 (a marketing member and an admin: the Academy lists the Avenue and knows the lesson, the
  lesson opens with its ten chapters, chapter 1's six cards, every chapter paints, seven questions, the perfect score and
  the lesson saved done with 100, the page never says AI, no page errors). Fixture test/fx_w243.json carries the rows.
- Nothing in the front end changed: the Hub build stays 6f0b740cd5b78569dab8a020d0ca1ddf.
