-- =====================================================================
-- Welfare Avenue Hub: draft schema comments for the public schema
-- Drafted 26 Sep 2026 from a read-only audit (see db_findings.md).
-- Audience: AI agents and developers reading the schema.
--
-- Comments only: no data, table or policy changes. Safe to apply in one
-- transaction. Re-running replaces earlier comments. Five tables and five
-- columns already had comments; their content is kept and extended here.
-- Only facts verified from code, docs or data are stated; guesses say so.
--
-- Conventions used in these comments:
--   Team code: one of opsmtl, opsto, progdev, marketing, fundraising, hr,
--   board (the dept_meta.department values). No foreign key enforces it.
--   "Display name": team_members.name (usually a first name), stored as text.
--   "Service role": edge functions and cron; they bypass row-level security.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Work: tasks, projects, goals, decisions, team pages
-- ---------------------------------------------------------------------

comment on table public.dept_tasks is 'Source of truth for tasks of every team. Written by the Hub pages (team boards, task drawer), by AI from meeting transcripts and emails (apply_transcript_result via process-transcript, process-leadership, mail-pull), by Ask the Hub, check-in and the bank functions. Use done (not status) to know whether a task is finished; banked rows (banked_at set) are hidden from the web app by a restrictive policy.';
comment on column public.dept_tasks.department is 'Team code that owns the task (opsmtl, opsto, progdev, marketing, fundraising, hr, board). No foreign key.';
comment on column public.dept_tasks.subsection is 'Free-text group within the team, such as Fundraising events, Content, Grants. Not a code list.';
comment on column public.dept_tasks.owner is 'Who owns the task as free text: a display name, sometimes several names in one string. task_assignees holds the same fact by member id and the two can disagree; prefer task_assignees.';
comment on column public.dept_tasks.status is 'Legacy free-text status (Open, In progress, Done, Waiting, Blocked, dated variants and one-off notes). Not reliable: many finished tasks still say Open. Use done and closed_at instead.';
comment on column public.dept_tasks.flag is 'True when the task is flagged for leadership attention (listed first in the weekly Slack digest). reason_category and reason_note say why.';
comment on column public.dept_tasks.priority is 'Unused boolean (false in every row). flag is the marker in use.';
comment on column public.dept_tasks.done is 'Source of truth for completion. The trigger set_task_closed_at sets closed_at when done becomes true and clears it otherwise.';
comment on column public.dept_tasks.updated_by is 'Who last changed the task: a display name, or ''AI: <transcript title>'' when AI wrote it. wa_stamp_restricted() and wa69_general_link() match that text to find rows created from a transcript.';
comment on column public.dept_tasks.opened_at is 'When the task was created.';
comment on column public.dept_tasks.closed_at is 'When the task was marked done. Maintained by the trigger set_task_closed_at.';
comment on column public.dept_tasks.reason_category is 'Why the task is flagged: Strategy or direction, Budget or purchase, Hiring or people, Partnership or external (same list as decisions.reason_category). Often filled by suggest-reason.';
comment on column public.dept_tasks.confidential is 'When true, board viewers cannot read the task. Currently false in every row.';
comment on column public.dept_tasks.board_only is 'When true, only people in board_circle can read the task (being an admin is not enough). Service-role jobs must filter it out themselves.';
comment on column public.dept_tasks.visibility is 'Restricted-meeting visibility copied from the source transcript: NULL or department (everyone), leadership, private. Checked by wa_sees_restricted(). CHECK: NULL, empty, department, leadership or private. Never set so far.';
comment on column public.dept_tasks.allowed_people is 'JSON array of display names or emails allowed to see a private row (used with visibility = private). Never set so far.';
comment on column public.dept_tasks.project_id is 'Project the task belongs to (projects.id). General work is either NULL or the team''s "General ..." project (wa69_general_link() moves AI-created tasks there).';
comment on column public.dept_tasks.parent_task_id is 'Parent task for subtasks (dept_tasks.id). Not used yet.';
comment on column public.dept_tasks.banked_at is 'Set when the task is parked in the bank (wave132). Banked tasks are hidden from the web app by the restrictive policy dept_tasks_not_banked and come back on bank_until.';
comment on column public.dept_tasks.bank_until is 'Date the banked task comes back (bank_resurface() runs daily at 10:05 UTC).';
comment on column public.dept_tasks.bank_note is 'Why the task was banked (up to 300 characters).';
comment on column public.dept_tasks.banked_by is 'Display name of who banked the task.';
comment on column public.dept_tasks.bank_due is 'The due_date the task had when it was banked; restored when it comes back if still in the future.';
comment on column public.dept_tasks.bank_project_id is 'Set when the task was banked together with a whole project (projects.id). Foreign key (on delete set null).';
comment on column public.dept_tasks.resurfaced_at is 'When the task last came back from the bank.';

comment on table public.task_assignees is 'People assigned to a task, by id: one row per (task_id, member_id). The id-based counterpart of dept_tasks.owner and the better source for who owns a task. Written by the task drawer and by apply_transcript_result.';
comment on column public.task_assignees.task_id is 'dept_tasks.id (cascade delete).';
comment on column public.task_assignees.member_id is 'team_members.id (cascade delete).';

comment on table public.task_comments is 'Comments and activity on a task: quotes captured by AI from transcripts and Slack (transcript-requests) and comments typed in the task drawer.';
comment on column public.task_comments.task_id is 'dept_tasks.id. Foreign key (on delete cascade).';
comment on column public.task_comments.author is 'Author label. For AI-captured comments this is a system label, not a person.';
comment on column public.task_comments.source is 'Where the comment came from: transcript, slack or manual.';
comment on column public.task_comments.source_ref is 'Id of the source item (for example a transcript id) as text.';
comment on column public.task_comments.source_label is 'Readable name of the source, such as a meeting title.';
comment on column public.task_comments.quote is 'Verbatim quote from the source that supports the comment.';

comment on table public.task_due_suggestions is 'Due dates proposed by AI (transcript-requests) for existing tasks, waiting for a person to accept or dismiss on the task. All rows are still pending.';
comment on column public.task_due_suggestions.task_id is 'dept_tasks.id. Foreign key (on delete cascade).';
comment on column public.task_due_suggestions.transcript_id is 'transcripts.id the date came from. Foreign key (on delete set null).';
comment on column public.task_due_suggestions.confidence is 'Model confidence on a 1 to 10 scale (values seen 6 to 10).';
comment on column public.task_due_suggestions.status is 'pending, accepted or dismissed (only pending seen so far).';

comment on table public.task_files is 'Files and links attached to a task: uploads in the private task-files bucket or Google Drive links. Empty so far.';
comment on column public.task_files.task_id is 'dept_tasks.id (cascade delete).';
comment on column public.task_files.by is 'Display name of who attached the file (as sent by the page).';
comment on column public.task_files.by_email is 'Email of who attached the file; the trigger task_files_stamp overwrites it with the signed-in email.';
comment on column public.task_files.path is 'Object path in the task-files bucket when kind = upload.';
comment on column public.task_files.url is 'Link when kind = link (usually Google Drive).';

comment on table public.projects is 'Projects that group tasks within a team, optionally nested (parent_id) and linked to a goal. Every team has a "General ..." project for loose tasks. Projects can be parked in the bank with their open tasks; banked projects are hidden from the web app by a restrictive policy.';
comment on column public.projects.department is 'Team code that owns the project.';
comment on column public.projects.parent_id is 'Parent project (projects.id) for sub-projects.';
comment on column public.projects.status is 'Project status; only active is used today. No CHECK.';
comment on column public.projects.goal_id is 'Goal this project serves (goals.id).';
comment on column public.projects.leads is 'JSON array of project lead display names (0 to 2). wa_leads_project() matches the signed-in person by name.';
comment on column public.projects.workstream is 'Free-text workstream label within the team, such as Fundraising events, Donor program, Grants.';
comment on column public.projects.banked_at is 'Set when the project (with its sub-projects and open tasks) is parked in the bank. See dept_tasks.banked_at.';
comment on column public.projects.bank_until is 'Date the banked project comes back.';

comment on table public.goals is 'Quarterly and organisational goals per team. Synced both ways with the ClickUp quarterly goal lists by goal-sync (daily cron); goals created in the Hub have source = dashboard.';
comment on column public.goals.department is 'Team code, or org for organisation-wide goals (org is not in dept_meta).';
comment on column public.goals.quarter is 'Period as text: Q4 FY2026, Q1 FY2027 or FY2027. The fiscal year starts on 1 October.';
comment on column public.goals.status is 'ClickUp-style status text: in progress, not started, closed, in review, delayed, incomplete, on track. No CHECK.';
comment on column public.goals.progress is 'Unused (NULL in every row).';
comment on column public.goals.source is 'Where the goal came from: the ClickUp list name and id, or dashboard.';
comment on column public.goals.task_ids is 'Unused array of dept_tasks ids (empty in every row). Link tasks through projects.goal_id instead.';
comment on column public.goals.clickup_task_id is 'ClickUp task id of the mirrored goal (goal-sync).';
comment on column public.goals.suggestions is 'Latest AI gap analysis for this goal from goal-suggest: {note, generated, covered, suggestions}.';
comment on column public.goals.parent_goal_id is 'Parent goal (goals.id) for sub-goals.';
comment on column public.goals.owner is 'Unused (NULL in every row).';
comment on column public.goals.why is 'SMART goal field "why" (wave116f). Unused so far.';
comment on column public.goals.approach is 'SMART goal field "approach" (wave116f). Unused so far.';
comment on column public.goals.success is 'SMART goal field "what success looks like" (wave116f). Unused so far.';

comment on table public.goal_comments is 'Comments on a goal, synced with ClickUp task comments by goal-sync.';
comment on column public.goal_comments.goal_id is 'goals.id (cascade delete).';
comment on column public.goal_comments.clickup_comment_id is 'ClickUp comment id once synced.';

comment on table public.goal_ideas is 'Latest AI goal suggestions per team, one row per team code, overwritten by goal-propose.';
comment on column public.goal_ideas.department is 'Team code (primary key).';
comment on column public.goal_ideas.payload is 'JSON from goal-propose: {note, generated, suggestions}.';

comment on table public.goal_wins is 'Evidence of progress toward a goal found in meeting transcripts (a win and a supporting quote), written by transcript-requests.';
comment on column public.goal_wins.goal_id is 'goals.id (cascade delete).';
comment on column public.goal_wins.transcript_id is 'transcripts.id the win came from. Foreign key (on delete set null).';
comment on column public.goal_wins.visibility is 'Copied restricted-meeting visibility (NULL, department, leadership, private). CHECK: NULL, empty, department, leadership or private. Never set so far.';

comment on table public.decisions is 'Executive decisions log: open questions for leadership, AI recommendations and outcomes. Rows come from transcript processing (apply_transcript_result), process-leadership, mail-pull and the executive dashboard; recommend-decision writes recommendation.';
comment on column public.decisions.pos is 'Manual sort position on the executive dashboard.';
comment on column public.decisions.area is 'Team as a label (Fundraising, Ops TO, Ops MTL, HR, Board, Marketing, Grants), not a team code. See db_findings.md section 3.';
comment on column public.decisions.suggested_move is 'The proposed decision or next step.';
comment on column public.decisions.done is 'True when the decision has been made. decided_at and decided_note record the outcome (3 done rows have no decided_at).';
comment on column public.decisions.reason_category is 'Category of decision: Hiring or people, Budget or purchase, Partnership or external, Strategy or direction, Ethics or policy, Board Strat.';
comment on column public.decisions.confidential is 'When true, board viewers cannot read the row.';
comment on column public.decisions.board_only is 'When true, only board_circle members can read the row.';
comment on column public.decisions.visibility is 'Restricted-meeting visibility (NULL, department, leadership, private). CHECK: NULL, empty, department, leadership or private. Never set so far.';
comment on column public.decisions.allowed_people is 'JSON array of names or emails for private rows. Never set so far.';
comment on column public.decisions.raised_by is 'Free text naming who raised the question (often a meeting or source label).';
comment on column public.decisions.owner is 'Display name of who should decide.';
comment on column public.decisions.recommendation is 'AI recommendation text from recommend-decision; recommendation_at is when it was written.';

comment on table public.dept_updates is 'Dated status updates per team. Mostly written by AI from meeting transcripts and filed emails (apply_transcript_result, process-leadership, mail-pull); some typed on the team page.';
comment on column public.dept_updates.department is 'Team code.';
comment on column public.dept_updates.entry_label is 'Free-text label packing a date and a source, such as ''Aug 9 (Otter)'' or ''Jul 12 (Slack digest)''. Not a date column.';
comment on column public.dept_updates.text is 'The update text.';
comment on column public.dept_updates.added_by is 'Who added it: ''AI: <transcript title>'' for AI rows (used as a link back to the transcript), otherwise a name or email.';
comment on column public.dept_updates.confidential is 'When true, board viewers cannot read the row.';
comment on column public.dept_updates.board_only is 'When true, only board_circle members can read the row.';
comment on column public.dept_updates.visibility is 'Restricted-meeting visibility (NULL, department, leadership, private). CHECK: NULL, empty, department, leadership or private. Never set so far.';

comment on table public.dept_meta is 'One row per team; department is the canonical team code list (opsmtl, opsto, progdev, marketing, fundraising, hr, board). label, short_label, sort and color say how to show each team. Holds the AI''s current read of the team, progress text and priorities (written by apply_transcript_result), the header image, the meeting schedule, and a cache of upcoming meetings written by calendar-sync.';
comment on column public.dept_meta.department is 'Team code (primary key). The canonical list of team codes; other tables store these codes without a foreign key.';
comment on column public.dept_meta.read is 'The AI''s short read of how the team is doing, rewritten after each processed transcript.';
comment on column public.dept_meta.progress is 'The AI''s progress narrative for the team, rewritten after each processed transcript.';
comment on column public.dept_meta.priorities is 'JSON array of strings: the team''s current priorities, written by AI.';
comment on column public.dept_meta.header_image_url is 'Public URL of the team page header image (dept-images bucket).';
comment on column public.dept_meta.meeting_schedule is 'Human-readable meeting rhythm of the team.';
comment on column public.dept_meta.calendar_match is 'JSON array of words used by calendar-sync to tag hub_events with this team.';
comment on column public.dept_meta.meeting_cache is 'JSON array of upcoming meetings {title, start, link}, a cache of hub_events written by calendar-sync; meeting_cache_at is when.';

comment on table public.dept_sentiment is 'Sentiment score per team and capture date, derived from Slack messages by slack-pull (weekly cron).';
comment on column public.dept_sentiment.score is 'Sentiment score (values seen 6 to 9; scale assumed 1 to 10, unverified).';
comment on column public.dept_sentiment.confidence is 'low, medium or high.';

comment on table public.metrics is 'KPI definitions and current values per team, shown as "KPIs we track". Staff update values inline on the team page.';
comment on column public.metrics.key is 'Stable KPI key, unique (for example servings_biweekly_mtl).';
comment on column public.metrics.department is 'Team code the KPI belongs to.';
comment on column public.metrics.unit is 'Display unit such as $, $/mo, servings, followers.';

comment on table public.item_status is 'Legacy: done flags for items of the original static dashboard (keys like hr-6, dec-2). No code reads or writes it; last write 30 Jun 2026. Candidate for removal.';

-- ---------------------------------------------------------------------
-- Requests and the team inbox
-- ---------------------------------------------------------------------

comment on table public.dept_requests is 'Requests filed to a team (design, print, hiring, time off, purchase orders and more). Created from the Requests page, from meetings (accepted request_suggestions), by Ask the Hub, by time off and from email. New rows and changes are announced in the team''s Slack channel by team-inbox (triggers trg_wa123_request_new and trg_wa123_request_update).';
comment on column public.dept_requests.type_key is 'request_types.key (foreign key).';
comment on column public.dept_requests.department is 'Team code the request is addressed to.';
comment on column public.dept_requests.details is 'Answers to the request form. Usually a JSON object keyed by form field labels; older rows hold a plain JSON string.';
comment on column public.dept_requests.status is 'Status from the type''s own list (request_types.statuses), such as requested, approved, interviewing. Free text; done is the reliable finished flag.';
comment on column public.dept_requests.requested_by is 'Display name of who asked.';
comment on column public.dept_requests.requested_email is 'Email of who asked; defaults to the signed-in email.';
comment on column public.dept_requests.assignee is 'Display name of who handles it (defaults to request_types.default_assignee).';
comment on column public.dept_requests.priority is 'normal or urgent (CHECK).';
comment on column public.dept_requests.source is 'Where it was filed: requests, meeting, ask, timeoff or email.';
comment on column public.dept_requests.mail_id is 'hub_mail.id when filed from an email. Foreign key (on delete set null).';
comment on column public.dept_requests.slack is 'Slack post of the request: {channel, channel_id, ts, url, at}.';

comment on table public.request_types is 'Catalogue of request types per team: the form fields, the status list, the default assignee and the Slack channel. Edited in the Requests settings.';
comment on column public.request_types.key is 'Stable kebab-case key used by dept_requests.type_key and request_suggestions.type_key.';
comment on column public.request_types.department is 'Team code that receives this type.';
comment on column public.request_types.fields is 'JSON array of form fields: [{name, label, type, required}].';
comment on column public.request_types.statuses is 'JSON array of status labels for this type, in order. Casing is inconsistent across types.';
comment on column public.request_types.default_status is 'Status given to a new request.';
comment on column public.request_types.source is 'Where the type came from: a ClickUp list name and id, or dashboard.';
comment on column public.request_types.default_assignee is 'Display name of the default assignee.';
comment on column public.request_types.channel is 'Slack channel id that overrides the team''s channel for this type.';
comment on column public.request_types.channel_mode is 'full (post the details) or brief (post without details, used for time off).';

comment on table public.request_notes is 'Notes added to a request by staff (insert own, delete own or admin). Each new note is announced by team-inbox. Empty so far.';
comment on column public.request_notes.request_id is 'dept_requests.id (cascade delete).';
comment on column public.request_notes.email is 'Author email; defaults to the signed-in email.';

comment on table public.request_suggestions is 'Requests proposed by AI from meeting transcripts (transcript-requests), waiting for a person to accept (which files a dept_requests row) or dismiss.';
comment on column public.request_suggestions.transcript_id is 'transcripts.id the suggestion came from. Foreign key (on delete cascade).';
comment on column public.request_suggestions.type_key is 'request_types.key. No foreign key yet.';
comment on column public.request_suggestions.status is 'pending, accepted or dismissed.';
comment on column public.request_suggestions.request_id is 'dept_requests.id created when accepted. Foreign key (on delete set null).';
comment on column public.request_suggestions.kind is 'new (file a new request). target_request_id is reserved for updates to an existing request and is unused so far.';
comment on column public.request_suggestions.confidence is 'Model confidence on a 1 to 10 scale (values seen 7 to 10).';

comment on table public.hub_mail is 'Emails received by the hub@ mailbox, pulled every 30 minutes by mail-pull, classified by AI and filed into what they describe (tasks, transcripts, requests, candidates). filed records what was created so an email can be undone or refiled.';
comment on column public.hub_mail.gmail_id is 'Gmail message id (unique). Test messages start with test-.';
comment on column public.hub_mail.kind is 'Classifier result: invoice, meeting_summary, update, application or noise.';
comment on column public.hub_mail.status is 'Processing state: new, filed, ignored, undone or failed.';
comment on column public.hub_mail.department is 'Team code the email was filed to, if any.';
comment on column public.hub_mail.attachments is 'JSON array [{filename, mime, size, attachmentId}]; files are stored in the private hub-mail bucket when filed.';
comment on column public.hub_mail.links is 'JSON array of URLs found in the body.';
comment on column public.hub_mail.filed is 'JSON describing what the email created: {type, id, title, department, ...}. Used by undo and refile.';
comment on column public.hub_mail.team_state is 'Team inbox state set by team_inbox_mail(): open, done or request. Unused so far.';
comment on column public.hub_mail.request_id is 'dept_requests.id created from the email in the team inbox. Foreign key (on delete set null).';
comment on column public.hub_mail.confidence is 'Classifier confidence from 0 to 1.';

comment on table public.hub_mail_state is 'Singleton (id = 1) sync status for mail-pull: last sync, last message date seen, run count, last result and error.';

comment on table public.hub_candidates is 'Job applicants filed from email by mail-pull, with CV and hiring stage; managed in the HR centre. status: new, reviewing, interview, offer, hired, declined, withdrawn. request_id links the hiring request (position) when matched. Empty so far.';
comment on column public.hub_candidates.request_id is 'dept_requests.id of the hiring request (position). Foreign key (on delete set null).';
comment on column public.hub_candidates.mail_id is 'hub_mail.id of the application email. Foreign key (on delete set null).';
comment on column public.hub_candidates.cv_path is 'Object path of the CV in the hub-mail bucket.';

-- ---------------------------------------------------------------------
-- Meetings, agendas, transcripts, calendar
-- ---------------------------------------------------------------------

comment on table public.transcripts is 'Meeting transcripts and summaries (from Otter, Plaud, Loom, Slack or email). On insert, trigger trg_transcript_insert posts every new row to process-transcript, which writes tasks, updates, decisions and dept_meta through apply_transcript_result and marks the row processed; rows whose department contains leadership are also sent to process-leadership (trg_wa65_leadership).';
comment on column public.transcripts.department is 'Team code of the meeting. One row says Leadership meeting instead of a code.';
comment on column public.transcripts.added_by is 'Who or what added it (a display name or a source label).';
comment on column public.transcripts.processed is 'True once AI processing has applied its results.';
comment on column public.transcripts.ai_summary is 'Short AI summary of the meeting.';
comment on column public.transcripts.fts is 'Generated full-text search vector used by search_transcripts().';
comment on column public.transcripts.board_only is 'When true, only board_circle members can read the transcript.';
comment on column public.transcripts.speakers is 'Speaker names extracted from the body by the trigger transcripts_set_speakers (extract_speakers()).';
comment on column public.transcripts.visibility is 'Restricted meeting: NULL or department (everyone), leadership, private. wa_stamp_restricted() copies it to the rows the meeting created. CHECK: NULL, empty, department, leadership or private. Never set so far.';
comment on column public.transcripts.allowed_people is 'JSON array of names or emails allowed to see a private meeting. Never set so far.';

comment on table public.transcript_request_scans is 'Ledger of transcripts already scanned by transcript-requests (every 2 hours), with how many suggestions it found. One row per transcript; service role writes, staff read.';
comment on column public.transcript_request_scans.transcript_id is 'transcripts.id (primary key). Foreign key (on delete cascade).';
comment on column public.transcript_request_scans.n_found is 'Number of suggestions (requests, wins, mentions, dates) found in the scan.';

comment on table public.mentions is 'People mentioned in meeting transcripts, with the quote and context, written by transcript-requests. The person sees their own mentions (matched by name); leaders see non-private ones.';
comment on column public.mentions.person is 'Display name of the person mentioned, as matched to the roster. Row-level security matches it to the signed-in person with wa_name_matches().';
comment on column public.mentions.transcript_id is 'transcripts.id. Foreign key (on delete cascade).';
comment on column public.mentions.department is 'Copied from the transcript (a team code, or Leadership meeting).';
comment on column public.mentions.seen is 'True once the person (or an admin) has seen it.';

comment on table public.plaud_seen is 'Legacy ledger of Plaud recording ids seen by an earlier transcript import, with why each was or was not imported. No current code reads or writes it; last write 11 Jul 2026. Candidate for removal.';

comment on table public.agendas is 'Meeting agendas built in the Hub. scope decides who sees it: department (the team), oneonone, leaders or group. Shareable by a secret link (agenda-share) that lets anyone with the link read the agenda and add items.';
comment on column public.agendas.department is 'Team code for department-scope agendas; NULL for other scopes.';
comment on column public.agendas.scope is 'department, oneonone, leaders or group (CHECK).';
comment on column public.agendas.status is 'draft, final or done (CHECK).';
comment on column public.agendas.created_by is 'Display name of the creator; row-level security matches it with wa_name_matches().';
comment on column public.agendas.with_person is 'Display name of the other person in a one-to-one.';
comment on column public.agendas.attendees is 'Display names of attendees; each attendee can read and edit the agenda.';
comment on column public.agendas.share_token is 'Secret token of the public share link (agenda-share). Treat as a credential.';
comment on column public.agendas.purpose is 'Meeting purpose. Unused so far.';
comment on column public.agendas.summary is 'Meeting summary. Unused so far.';

comment on table public.agenda_items is 'Lines on an agenda: a topic, project, decision or update, with optional linked tasks. Written by the agenda page, build-agenda (AI draft) and the public share link.';
comment on column public.agenda_items.agenda_id is 'agendas.id (cascade delete).';
comment on column public.agenda_items.kind is 'topic, project, decision or update (CHECK).';
comment on column public.agenda_items.task_ids is 'Array of dept_tasks ids discussed under this item. Arrays cannot carry a foreign key.';
comment on column public.agenda_items.source is 'Where the item came from; only app is used.';

comment on table public.hub_events is 'Mirror of the hub@welfareavenue.com Google Calendar, refreshed every 30 minutes by calendar-sync (and by hub-connect when a person connects a calendar). Source of meeting times across the Hub; do not edit rows by hand.';
comment on column public.hub_events.id is 'Google Calendar event id.';
comment on column public.hub_events.summary is 'Event title.';
comment on column public.hub_events.organizer is 'Organizer email.';
comment on column public.hub_events.attendees is 'JSON array [{email, name, status, optional, organizer}] from Google. attendee_emails holds the same emails as a text array.';
comment on column public.hub_events.attendee_emails is 'Lower-case attendee emails; calendar_my_meetings() uses it to find a person''s own meetings.';
comment on column public.hub_events.department is 'Team code matched from dept_meta.calendar_match, NULL when no team matched.';
comment on column public.hub_events.status is 'Google event status (confirmed; cancelled events are excluded by readers).';

comment on table public.hub_calendar_state is 'Sync status for calendar-sync, one row per mirrored Google calendar.';

-- ---------------------------------------------------------------------
-- Board
-- ---------------------------------------------------------------------

comment on table public.board_members is 'Board directors and advisers (wave126). A signed-in person is matched to a seat through emails (my_board_member_id()). Admins edit; everyone who can see the board reads.';
comment on column public.board_members.name is 'Short display name (unique).';
comment on column public.board_members.emails is 'All emails of the director; used to recognise them at sign-in.';
comment on column public.board_members.seat is 'Board role or seat, as text.';
comment on column public.board_members.renewal is 'Term renewal as text (such as Q3 2026); renewal_due is the date form.';
comment on column public.board_members.status is 'active, adviser, resigned or former (CHECK).';

comment on table public.board_committees is 'The four board committees (fundraising, people, operations, fiduciary), with chair, members, internal staff leads and the teams they oversee.';
comment on column public.board_committees.key is 'Committee key: fundraising, people, operations or fiduciary (CHECK). Not a team code.';
comment on column public.board_committees.chair_id is 'board_members.id of the chair.';
comment on column public.board_committees.member_ids is 'Array of board_members ids on the committee (no foreign key possible on an array).';
comment on column public.board_committees.internal_leads is 'Display names of staff leads for the committee.';
comment on column public.board_committees.depts is 'Array of team codes the committee oversees.';
comment on column public.board_committees.status is 'Committee status; only created is used.';

comment on table public.board_items is 'Board work items grouped by the board''s three jobs (steward, fiduciary, strategy), optionally tied to a committee and to a dept_tasks row.';
comment on column public.board_items.job is 'steward, fiduciary or strategy (CHECK).';
comment on column public.board_items.committee is 'board_committees.key.';
comment on column public.board_items.status is 'done, in_progress, todo, at_risk, watch or standing (CHECK).';
comment on column public.board_items.owner is 'Free-text owner (a name or a group).';
comment on column public.board_items.due is 'Free-text due description, not a date.';
comment on column public.board_items.task_id is 'dept_tasks.id when the item mirrors a staff task. Foreign key (on delete set null).';
comment on column public.board_items.source is 'Where the item came from, such as a board deck or minutes.';

comment on table public.board_meetings is 'Register of board meetings with agenda and notes links. Board leaders write; everyone who can see the board reads.';
comment on column public.board_meetings.kind is 'board, special, agm or strategy (CHECK).';
comment on column public.board_meetings.status is 'held, scheduled, tentative, to schedule or cancelled (CHECK).';

comment on table public.board_touchpoints is 'Log of committee contacts, meetings and recommendations recorded by board members; each person edits their own. Empty so far.';
comment on column public.board_touchpoints.committee is 'board_committees.key (cascade delete).';
comment on column public.board_touchpoints.kind is 'internal, external, meeting, recommendation or note (CHECK).';
comment on column public.board_touchpoints.member_id is 'board_members.id of the director concerned.';
comment on column public.board_touchpoints.meeting_id is 'board_meetings.id when tied to a meeting.';
comment on column public.board_touchpoints.logged_by_email is 'Email of who logged it; defaults to the signed-in email.';

comment on table public.board_circle is 'Access list: emails of the board-only confidentiality tier. Rows flagged board_only in dept_tasks, dept_updates, decisions, transcripts and change_log are visible only to these people (is_board_circle()). Not the list of directors (see board_members).';
comment on column public.board_circle.email is 'Lower-case email.';

comment on table public.board_viewers is 'Access list: emails of read-only board viewers who may open board pages without being staff (is_board_viewer(), get_my_role() = board). Admins edit.';
comment on column public.board_viewers.email is 'Lower-case email.';

-- ---------------------------------------------------------------------
-- People, access and HR
-- ---------------------------------------------------------------------

comment on table public.team_members is 'Staff and board roster; id is the key other tables should use for a person (task_assignees, onboardings, org_positions). Kept in step with Google Workspace by directory-sync; invitations by hub-invite. Triggers notify on invites (trg_wa89_invited), assign an access profile (wa_auto_profile) and add new staff to the org chart (wa133_roster_sync).';
comment on column public.team_members.name is 'Display name, usually a first name. Many tables store this text instead of the id; it is unique in practice but not by constraint.';
comment on column public.team_members.email is 'Lower-case Workspace email; NULL for roster entries without an account.';
comment on column public.team_members.department is 'Team code.';
comment on column public.team_members.role is 'Job title as free text (not the Hub access role; see hub_roles.role).';
comment on column public.team_members.active is 'False for people who left. Readers usually filter active = true.';
comment on column public.team_members.ai_bio is 'Short AI-written job description from person-profile; ai_bio_at is when.';
comment on column public.team_members.responsibilities is 'JSON array of 3 to 5 responsibility lines (strings).';
comment on column public.team_members.jd_url is 'Link to the job description document; jd_name is its title.';
comment on column public.team_members.start_source is 'Where start_date came from: google (Workspace account creation) or manual (set by HR).';

comment on table public.hub_directory is 'Mirror of Google Workspace accounts, synced daily by directory-sync. Links each account to the roster (member_id) and holds the queue of accounts an admin still has to place, dismiss or skip. Not a person key; use team_members.';
comment on column public.hub_directory.email is 'Primary Workspace email (primary key).';
comment on column public.hub_directory.org_unit is 'Google organisational unit path (such as /), not a team code.';
comment on column public.hub_directory.is_admin is 'True for Google Workspace admins (not Hub admins).';
comment on column public.hub_directory.member_id is 'team_members.id the account is linked to. Foreign key (on delete set null).';
comment on column public.hub_directory.deactivated_member_id is 'team_members.id that was deactivated because the account was suspended or deleted. Foreign key (on delete set null).';
comment on column public.hub_directory.aliases is 'Other addresses of the account; my_emails() uses them to find a person''s meetings.';
comment on column public.hub_directory.placed_by is 'Email of the admin who linked the account to the roster.';

comment on table public.hub_directory_state is 'Singleton (id = 1) sync status for directory-sync, with the last run summary in last_result.';
comment on column public.hub_directory_state.last_result is 'JSON summary of the last run: users, matched, queued, new_in_queue, deactivated, reactivated, photos, start_dates and more.';

comment on table public.hub_roles is 'Hub access per email. role decides the tier; profile picks the page set from hub_access_profiles. Admins write; a staff member may insert their own member row. The trigger wa72_founder_guard keeps the founders as admins; wa_auto_profile assigns a profile when enabled.';
comment on column public.hub_roles.email is 'Lower-case email (primary key).';
comment on column public.hub_roles.role is 'admin, leader, member, viewer or blocked (CHECK). blocked denies access even for a welfareavenue.com email.';
comment on column public.hub_roles.profile is 'hub_access_profiles.key. NULL means no profile. Foreign key (on delete set null).';
comment on column public.hub_roles.tabs is 'Legacy per-person page list (NULL in every row). wa_page_ok() still defers to it when it is a non-empty array.';

comment on table public.hub_access_profiles is 'Access profiles (wave127): one per team plus executive, admin and board. pages says which Hub pages the profile opens; tier is the minimum role needed. Admins edit.';
comment on column public.hub_access_profiles.key is 'Profile key: a team code, or executive, admin, board.';
comment on column public.hub_access_profiles.tier is 'Minimum hub_roles.role for the profile to apply: viewer, member, leader or admin (CHECK).';
comment on column public.hub_access_profiles.team is 'Team code of a team profile; NULL for executive, admin and board.';
comment on column public.hub_access_profiles.pages is 'JSON object: page key to all (everyone with the profile), lead (leaders and admins only) or none. Read by wa_page_ok() and the page.';
comment on column public.hub_access_profiles.can is 'JSON array of plain-language sentences describing what the profile can do (display text, not codes).';

comment on table public.hub_access_settings is 'Singleton (id = 1) switches for access profiles, such as auto_profile (assign a profile automatically to new members and leaders).';

comment on table public.wa_access_requests is 'Requests from staff for more Hub access, decided by an admin (status new, granted or declined). Empty so far.';

comment on table public.wa_hr_access is 'Access list: emails with HR access (wa_is_hr()), who can read and decide time off, discipline records and policy sign-offs. Readable by every signed-in user.';

comment on table public.wa_discipline is 'HR discipline records. Readable by HR (wa_hr_access) and by the person concerned; only HR writes.';
comment on column public.wa_discipline.category is 'ack_messages, time_commitment, missed_meetings, conduct or other (CHECK).';
comment on column public.wa_discipline.level is 'Level of the step taken, as text. No CHECK.';
comment on column public.wa_discipline.clean_slate is 'True when the record marks a clean slate.';

comment on table public.wa_timeoff is 'Time-off requests. The person inserts and reads their own; HR reads, decides and deletes.';
comment on column public.wa_timeoff.category is 'vacation, school_break, sick, bereavement, religious, wedding or other (CHECK).';
comment on column public.wa_timeoff.status is 'requested, approved or declined (CHECK).';

comment on table public.wa_policies is 'HR policies staff must read and sign (link to the document). HR edits; everyone reads.';
comment on table public.wa_policy_signoffs is 'Who signed which policy and when; one row per (email, policy_key).';
comment on column public.wa_policy_signoffs.policy_key is 'wa_policies.key (foreign key).';

comment on table public.onboardings is 'HR onboarding plans, one per new team member (at most one active per member). Created by onboarding_assign(), which also copies the checklist steps.';
comment on column public.onboardings.member_id is 'team_members.id of the new person.';
comment on column public.onboardings.person_name is 'Copy of the display name at assignment time.';
comment on column public.onboardings.status is 'active or completed.';
comment on column public.onboardings.started_at is 'Start date of the plan; step due dates are computed from it by onb_due().';

comment on table public.onboarding_steps is 'Checklist steps of one onboarding plan, copied from onboarding_template (one row per plan and template step).';
comment on column public.onboarding_steps.template_id is 'onboarding_template.id.';
comment on column public.onboarding_steps.due_date is 'Due date from onb_due(section, started_at).';

comment on table public.onboarding_template is 'Master onboarding checklist in sections WEEK 1 to WEEK 4 and 60 DAYS, originally imported from ClickUp. Triggers copy new or re-activated steps to active plans (onboarding_template_propagate) and touch updated_at on content changes.';
comment on column public.onboarding_template.id is 'Step id as text (ClickUp task id for imported steps).';
comment on column public.onboarding_template.section is 'WEEK 1, WEEK 2, WEEK 3, WEEK 4 or 60 DAYS; drives onb_due(). No CHECK.';
comment on column public.onboarding_template.parent_id is 'Parent step (onboarding_template.id) for sub-steps.';
comment on column public.onboarding_template.content_pending is 'True when the step''s content is still to be written.';

comment on table public.onboarding_update_acks is 'Records that a person acknowledged a changed onboarding step (template_updated_at is the version they saw).';
comment on column public.onboarding_update_acks.onboarding_id is 'onboardings.id. Foreign key (on delete cascade).';
comment on column public.onboarding_update_acks.template_id is 'onboarding_template.id. Foreign key (on delete cascade).';

comment on table public.onboarding_help is 'Help requests raised by a new person on an onboarding step; each insert notifies Slack through notify (trigger on_onboarding_help). Empty so far.';

comment on table public.hr_setup_template is 'HR''s own setup checklist for a new person, in three phases (Before day one, The onboarding call, Manager follow-through). Changes propagate to active plans (hr_setup_propagate).';
comment on column public.hr_setup_template.id is 'Short step code (primary key).';

comment on table public.hr_setup_steps is 'Per-onboarding copies of hr_setup_template steps (one row per plan and step).';

comment on table public.wa_onboarding is 'Per-person "first steps in the Hub" checklist (profile, task, team page and more) keyed by email. Not HR onboarding; see onboardings.';
comment on column public.wa_onboarding.steps is 'JSON object: step key (such as profile, task, dept, info, brain) to a string recording completion.';

comment on table public.org_positions is 'Org chart seats (wave133): one seat per person or open position, with a reporting line. Read by staff; changed only through the org_* functions (executives and admins). New active staff are added automatically by wa133_roster_sync.';
comment on column public.org_positions.member_id is 'team_members.id holding the seat; NULL for an open position. Unique when set.';
comment on column public.org_positions.department is 'Team code of the seat.';
comment on column public.org_positions.reports_to is 'org_positions.id of the manager seat; NULL means it reports to the executive directors.';
comment on column public.org_positions.kind is 'exec or staff (CHECK). Exec seats stay at the top.';
comment on column public.org_positions.status is 'filled, open, hiring or on_hold (CHECK).';

comment on table public.user_state is 'Presence heartbeat: the last time each signed-in person was seen in the Hub (page upsert). Staff, admins and board read everyone''s to show who is online.';

comment on table public.hub_visits is 'One row per Hub opening (at most once per six hours per browser), written by the page at boot; admins read it through hub_adoption(). Starts 25 Sep 2026.';
comment on column public.hub_visits.ua is 'Browser user agent.';
comment on column public.hub_visits.source is 'hub (desktop) or phone.';

comment on table public.wa_usage is 'Daily seconds and visits per person, meant to be written by wa_usage_visit() and wa_usage_beat(). Empty: the page calls both without await, so the requests are never sent. Superseded by hub_visits and user_state; candidate for removal.';

comment on table public.hub_checkins is 'Check-in and check-out sessions started from the Hub, with minutes worked and a summary; checkin-post posts each one to Slack. Open sessions close themselves after eight hours (auto_closed).';
comment on column public.hub_checkins.name is 'Copy of the display name.';
comment on column public.hub_checkins.department is 'Team code at check-in.';
comment on column public.hub_checkins.slack_ts is 'Slack timestamp of the check-in message; slack_out_ts of the check-out message.';
comment on column public.hub_checkins.closed_task_ids is 'dept_tasks ids closed during the session.';

comment on table public.hub_shoutouts is 'Shout-outs shown on the home page: generated daily by the shoutouts job (kind auto) or posted by staff (kind manual). They expire after ten days by default.';
comment on column public.hub_shoutouts.kind is 'auto or manual.';
comment on column public.hub_shoutouts.source is 'What triggered it: tasks, project, hours, hire, anniversary, welcome or manual.';
comment on column public.hub_shoutouts.ref is 'De-duplication key for automatic shout-outs (unique when set).';
comment on column public.hub_shoutouts.person is 'Display name of the person celebrated; member_id is the roster id.';
comment on column public.hub_shoutouts.team is 'Team code.';
comment on column public.hub_shoutouts.by is 'Email of who posted a manual shout-out.';

comment on table public.hub_birthdays is 'Birthdays people chose to share (month and day, no year). share: everyone, team or me. Empty so far.';
comment on table public.hub_announcements is 'Manual "What''s new" announcements posted by leaders and admins (pinned, expiring). Empty so far.';
comment on column public.hub_announcements.department is 'Team code the announcement is about, or NULL for everyone.';

comment on table public.hub_connections is 'Per-person connections made through hub-connect: provider slack, google_calendar or google_drive, with the external account id and name. Readable by the person and admins.';
comment on column public.hub_connections.external_id is 'Account id at the provider (for Slack the user id).';
comment on column public.hub_connections.meta is 'JSON details from the provider, such as {handle}.';

comment on table public.wa_notify_prefs is 'Per-person notification preferences, read by notify and team-inbox. Empty so far.';
comment on column public.wa_notify_prefs.disabled is 'JSON array of notification kinds the person turned off.';
comment on column public.wa_notify_prefs.prefs is 'JSON object of further preferences (wave116j). Shape not in use yet.';

comment on table public.wa_change_requests is 'Change requests about the Hub filed by staff from the page or the /hub Slack command; admins update the status. Empty so far.';

comment on table public.slack_hours is 'Weekly hours per person parsed from the Slack check-in channels by hours-pull (daily cron): sessions pair an in with the next out, up to 16 hours, in Toronto time.';
comment on column public.slack_hours.slack_name is 'Slack display name (part of the primary key).';
comment on column public.slack_hours.member_name is 'Roster display name matched from the Slack name; NULL when no match.';
comment on column public.slack_hours.department is 'Team code of the matched roster person.';
comment on column public.slack_hours.week_start is 'Monday of the week (Toronto time).';
comment on column public.slack_hours.missed_outs is 'Check-ins without a matching check-out.';

comment on table public.wa_checkin_scope is 'Summary of who posts in the Slack check-in channels over the last 30 days (message count, active days, AI summary), refreshed weekly by checkin-scope. Readable by welfareavenue.com accounts and one hardcoded personal address.';
comment on column public.wa_checkin_scope.slack_id is 'Slack user id (primary key).';

comment on table public.wa_slack_ids is 'Email to Slack user id map used to @mention people (notify, team-inbox, hub-connect write it). Service role only (row-level security on, no policies).';
comment on column public.wa_slack_ids.source is 'How the id was found (lookup by email, name match, or chosen by the person).';

comment on table public.wa_slack_names is 'Normalised name to Slack user id cache used to @mention people by name (project-slack, slack-digest, slack-command). Service role only.';
comment on column public.wa_slack_names.name_norm is 'Lower-case normalised name (primary key).';
comment on column public.wa_slack_names.source is 'users.list exact name, users.list first name, or pinned (set by hand).';

-- ---------------------------------------------------------------------
-- Training Academy
-- ---------------------------------------------------------------------

comment on table public.trainings is 'Training catalogue (wave122): Loom videos, reads, documents, SOP lessons, lessons with quizzes and Hub page tours. Written by the Academy pages and tour seeds.';
comment on column public.trainings.category is 'Category name (training_categories.name, no foreign key). One value, Our SOPs, is missing from training_categories.';
comment on column public.trainings.kind is 'tour, video, read, doc, sop or lesson. No CHECK.';
comment on column public.trainings.key is 'Stable key for seeded trainings (unique when set).';
comment on column public.trainings.path_group is 'Learning path, stored as academy_paths.name (not the path key).';
comment on column public.trainings.source is 'Where the training came from: hub, loom, clickup or a wave seed label.';
comment on column public.trainings.ext_id is 'External id, such as the Loom video id.';
comment on column public.trainings.body is 'Lesson content as JSON; the shape depends on kind (tours: {tab, tour}; SOP lessons: {phases, roles, dayof, money, links, ...}; lessons: {chapters, quiz, ...}).';
comment on column public.trainings.xp is 'Experience points awarded on completion.';

comment on table public.training_progress is 'Per-person progress on one training: status, percent, last step, score and time spent. Unique by (training_id, person_name), so a person is identified by display name.';
comment on column public.training_progress.training_id is 'trainings.id (cascade delete).';
comment on column public.training_progress.person_name is 'Display name of the learner (part of the unique key).';
comment on column public.training_progress.email is 'Learner email; filled only on newer rows.';
comment on column public.training_progress.status is 'assigned, started or done. No CHECK.';
comment on column public.training_progress.data is 'JSON learner state, such as {seen, quizTries}.';

comment on table public.training_categories is 'Category list for the training catalogue; trainings.category holds the name. Leaders manage.';
comment on column public.training_categories.department is 'Team code the category belongs to, or NULL for organisation-wide.';

comment on table public.academy_paths is 'Learning paths shown in the Training Academy. Trainings join a path by trainings.path_group = academy_paths.name. Leaders write; staff read.';
comment on column public.academy_paths.name is 'Path name; the join value used by trainings.path_group (unique).';
comment on column public.academy_paths.dept is 'Team code of a team path, NULL for organisation-wide paths.';
comment on column public.academy_paths.required is 'True for paths every staff member must complete.';

comment on table public.academy_awards is 'Badges, levels and certificates earned in the Training Academy, celebrated once. Unique by (person_name, award).';
comment on column public.academy_awards.kind is 'badge, level or cert. No CHECK.';
comment on column public.academy_awards.person_name is 'Display name of the learner (part of the unique key); email identifies them too.';
comment on column public.academy_awards.meta is 'JSON display details, such as {color, icon, n, path, items}.';

-- ---------------------------------------------------------------------
-- Volunteering (Sunday serving and other volunteer events)
-- ---------------------------------------------------------------------

comment on table public.volunteer_people is 'Volunteer directory: one row per volunteer with phones, emails, volunteer roles and tags, linked to Quo (OpenPhone) contacts by quo-sync. Possible duplicates are merged with volunteer_merge(). Contains personal data.';
comment on column public.volunteer_people.emails is 'All known emails of the volunteer.';
comment on column public.volunteer_people.phones is 'All known phone numbers; matching uses the last 10 digits.';
comment on column public.volunteer_people.roles is 'Volunteer roles the person does (such as cook, server, driver).';
comment on column public.volunteer_people.needs_review is 'True when the import found something to check (for example a shared phone); review_note says what.';
comment on column public.volunteer_people.quo_contact_id is 'Quo contact id linked by quo-sync; quo_synced_at is when.';

comment on table public.volunteer_events is 'Volunteer events, mostly the biweekly Sunday serving days in Montreal (kind service), plus drives and planning days. Creating a service event copies the run-sheet steps (trigger trg_event_steps); moving its date moves the step due dates.';
comment on column public.volunteer_events.code is 'Short unique event code in the form WA-yy-nn (with letter suffixes for extra events).';
comment on column public.volunteer_events.status is 'planned, in progress, completed or cancelled. No CHECK.';
comment on column public.volunteer_events.kind is 'service (Sunday serving), drive or planning.';
comment on column public.volunteer_events.season is 'Winter, Spring, Summer or Fall.';
comment on column public.volunteer_events.title is 'Optional title; readers show Sunday serving when NULL and kind = service.';
comment on column public.volunteer_events.itinerary_url is 'Link to the day''s itinerary document.';

comment on table public.event_roster is 'Who is rostered for each volunteer event and in which role, with their confirmation. Written by the volunteering page, by quo-send (which adds missing rows and a confirmation link) and by the public confirmation form.';
comment on column public.event_roster.event_id is 'volunteer_events.id (cascade delete).';
comment on column public.event_roster.person_id is 'volunteer_people.id; NULL for people not in the directory.';
comment on column public.event_roster.person_name is 'Copy of the volunteer''s name; can drift from volunteer_people.full_name.';
comment on column public.event_roster.role is 'Role at the event: server, cook, driver, photographer, dishwasher, team_leader, community_debrief (community_talker is also targeted by the page). No CHECK.';
comment on column public.event_roster.status is 'Attendance: Confirmed, TBD, Unavailable, Waiting For Response in older rows; the confirmation form writes lower-case confirmed or declined. Compare case-insensitively.';
comment on column public.event_roster.detail is 'JSON with per-event details and, in most rows, a copy of the volunteer''s phone, email and address: {phone, email, address, pickup_dropoff, ingredients_delivered, type_of_food}. Personal data.';
comment on column public.event_roster.confirm_token is 'Secret token of the volunteer''s personal confirmation link (volunteer_confirm_get and volunteer_confirm_submit). Treat as a credential.';
comment on column public.event_roster.confirm_status is 'Answer from the confirmation form: confirmed, declined or needs attention. Unused so far.';
comment on column public.event_roster.confirm is 'JSON answers submitted on the confirmation form. Unused so far.';
comment on column public.event_roster.recipe_id is 'recipes.id assigned to a cook. Unused so far.';

comment on view public.volunteer_event_summary is 'One row per volunteer event with roster size, confirmed count, run-sheet steps total and done, and extra to-dos total and open. Read by the volunteering page. Runs with the caller''s rights.';

comment on table public.volunteer_inventory is 'Serving supplies inventory by category, shareable by a token link through inventory-share (share settings in hub_settings key inventory_share).';
comment on column public.volunteer_inventory.qty_in is 'Quantity in stock, stored as text (all current values are whole numbers).';
comment on column public.volunteer_inventory.qty_remaining is 'Unused (NULL in every row).';
comment on column public.volunteer_inventory.reorder_needed is 'Unused (NULL in every row).';

comment on table public.recipes is 'Recipe list for serving days, each linked to a Google Drive document; assignable to cooks on the roster (event_roster.recipe_id).';

comment on table public.quo_messages is 'Log of SMS messages sent to volunteers through Quo (OpenPhone) by quo-send, or recorded as a dry run.';
comment on column public.quo_messages.batch_id is 'Groups the messages of one send.';
comment on column public.quo_messages.status is 'dry_run or sent (failed sends record error).';
comment on column public.quo_messages.sent_by is 'Who sent it (a name or system).';

comment on table public.sop_template is 'Sunday serving run-sheet: the steps of the serving SOP, imported from one ClickUp list by sop-import and edited in the Hub with sop_step_insert, sop_step_move and sop_step_deactivate. Changes propagate to planned events (sop_template_propagate). Not the SOP lessons in trainings.';
comment on column public.sop_template.id is 'Step id: the ClickUp task id for imported steps, or wa followed by 9 hex characters for steps added in the Hub.';
comment on column public.sop_template.parent_id is 'Parent step (sop_template.id). Foreign key (on delete set null).';
comment on column public.sop_template.section is 'Top-level section name from ClickUp (such as Itineraries, Post Event).';
comment on column public.sop_template.phase is 'When the step is due relative to the event: t_minus_2w, t_minus_1w, week_of, event_day, post_event or anytime. sop_phase_due() turns it into a date.';
comment on column public.sop_template.default_owner is 'Display name of the usual owner, copied to new event steps.';
comment on column public.sop_template.needs_review is 'True when the step text is known to be out of date; review_note explains.';
comment on column public.sop_template.has_secret is 'True when a shared password was scrubbed from the ClickUp description on import.';
comment on column public.sop_template.active is 'False for steps removed from the run-sheet; inactive steps are not copied to new events.';

comment on table public.sop_event_steps is 'Per-event copies of the run-sheet steps with owner, due date and done flag. The done flag has never been set so far.';
comment on column public.sop_event_steps.template_id is 'sop_template.id (cascade delete).';
comment on column public.sop_event_steps.owner is 'Display name of who does the step at this event.';
comment on column public.sop_event_steps.due_date is 'From sop_phase_due(phase, event_date); moves with the event date.';

comment on table public.sop_event_extras is 'Extra to-dos for one volunteer event, captured by AI from meeting transcripts (process-transcript) or added on the page.';
comment on column public.sop_event_extras.owner is 'Display name of who does it.';
comment on column public.sop_event_extras.source is 'Where it came from (transcript).';
comment on column public.sop_event_extras.transcript_id is 'transcripts.id it came from. Foreign key (on delete set null).';

comment on table public.sop_roles is 'Named serving roles and the run-sheet steps each role covers.';
comment on column public.sop_roles.step_ids is 'JSON array of sop_template ids covered by the role (no foreign key possible in JSON).';

comment on table public.sop_shots is 'Screenshots attached to run-sheet steps, copied from ClickUp into the public sop-shots bucket (sop-import, attach-rehost).';
comment on column public.sop_shots.template_id is 'sop_template.id (cascade delete).';
comment on column public.sop_shots.attachment_id is 'ClickUp attachment id.';
comment on column public.sop_shots.storage_path is 'Object path in the sop-shots bucket; public_url is the public link.';

-- ---------------------------------------------------------------------
-- Fundraising and finance
-- ---------------------------------------------------------------------

comment on table public.fund_events is 'Fundraising events calendar (plan 2026-27) with timing, partners, targets, status and results. Not the Google Calendar (hub_events) and not volunteer serving days (volunteer_events).';
comment on column public.fund_events.plan is 'Plan year label, 2026-27. Unique with title.';
comment on column public.fund_events.season is 'Season slot: backlog, summer-2026, fall-2026, winter-2027, spring-2027.';
comment on column public.fund_events."precision" is 'How precise the dates are: day, month, range, season, flexible or none (CHECK). The column name is a SQL keyword; quote it as "precision" to be safe.';
comment on column public.fund_events.timing is 'Display text for when the event happens; start_date and end_date are the real dates.';
comment on column public.fund_events.status is 'idea, planned, confirmed, done or cancelled (CHECK).';
comment on column public.fund_events.project_id is 'projects.id that runs the event.';
comment on column public.fund_events.sop_training_id is 'trainings.id of the SOP lesson for the event (a trainings row with kind = sop). Foreign key (on delete set null).';
comment on column public.fund_events.source is 'plan or plan + tasks (how the row was seeded).';
comment on column public.fund_events.lead is 'Unused (NULL in every row).';

comment on table public.finance_budgets is 'Budget amounts per fiscal year and period for each chart-of-accounts category (the budget lines). Category keys also feed the AI category list of finance-import. Staff with the Finances page write.';
comment on column public.finance_budgets.fiscal_year is 'Fiscal year label: FY24, FY25 or FY26 (the year starts on 1 October).';
comment on column public.finance_budgets.period is 'FY, Q1, Q2, Q3 or Q4 (CHECK).';
comment on column public.finance_budgets.scope is 'category (a budget line) or department (CHECK). Only category is used.';
comment on column public.finance_budgets.key is 'Chart-of-accounts category label when scope = category (such as 5020 Purchases - COS), a team code when scope = department.';
comment on column public.finance_budgets.kind is 'income or expense (CHECK).';

comment on table public.finance_statements is 'Bank statements uploaded for AI import (finance-import), one row per upload with the period and counts.';
comment on column public.finance_statements.status is 'processing, done or failed.';
comment on column public.finance_statements.uploaded_by is 'Email of the uploader, or system.';
comment on column public.finance_statements.dup_count is 'Transactions in this file that were already in the ledger.';

comment on table public.finance_transactions is 'Bank transactions extracted from statements by finance-import, with an AI-allocated team and category. Staff can re-allocate on the Finances page.';
comment on column public.finance_transactions.amount is 'Signed amount: negative for money out, positive for money in.';
comment on column public.finance_transactions.department is 'Team code, or org for organisation-wide costs (org is not in dept_meta). progdev is not used here.';
comment on column public.finance_transactions.category is 'Chart-of-accounts label (matches finance_budgets.key for scope = category), or Other.';
comment on column public.finance_transactions.source is 'Where the row came from; only statement is used.';
comment on column public.finance_transactions.statement_id is 'finance_statements.id of the import.';
comment on column public.finance_transactions.allocated_by is 'AI (high confidence), AI (low confidence), or the person who re-allocated it.';
comment on column public.finance_transactions.duplicate_of is 'finance_transactions.id of the earlier copy when the same transaction was imported again. Excluded from totals when set.';
comment on column public.finance_transactions.fingerprint is 'Duplicate detection key: date|amount|normalised description.';

-- ---------------------------------------------------------------------
-- Marketing and content
-- ---------------------------------------------------------------------

comment on table public.content_drafts is 'Branded content created with AI on the Create page (draft-content edge function). Staff only.';
comment on column public.content_drafts.content_type is 'email, social_post, graphic or report.';
comment on column public.content_drafts.audience is 'Target audience, such as partners, volunteers, sponsors_donors.';
comment on column public.content_drafts.language is 'en or fr.';
comment on column public.content_drafts.status is 'draft or in review.';

comment on table public.content_posts is 'Content calendar posts: planned, scheduled and published to the Facebook Page and Instagram by social-publish (cron every 5 minutes). Outgoing posts; social_posts holds published posts and their metrics.';
comment on column public.content_posts.platforms is 'Target platforms, such as instagram and facebook.';
comment on column public.content_posts.media is 'JSON array of media [{url, path, kind, mime, size, w, h, dur}] in the content-images bucket.';
comment on column public.content_posts.status is 'Workflow state; social-publish uses scheduled, publishing, posted and failed. No CHECK.';
comment on column public.content_posts.results is 'JSON of per-platform publish results written by social-publish.';
comment on column public.content_posts.live is 'JSON of per-platform live post ids and links written by social-publish.';
comment on column public.content_posts.owner is 'Display name of who owns the post.';

comment on table public.social_accounts is 'Connected social and analytics accounts (Facebook Page, Instagram, LinkedIn by CSV, GA4), managed by social-pull. Service role writes; staff and board viewers read.';
comment on column public.social_accounts.platform is 'facebook, instagram, tiktok, linkedin, ga4 or youtube (CHECK).';
comment on column public.social_accounts.status is 'connected, csv (data comes from CSV imports) or pending.';
comment on column public.social_accounts.meta is 'JSON provider details: {by, history, demographics, site, page_id, media_count}.';

comment on table public.social_daily is 'Daily metric values per account (one row per platform, account, day and metric), from the APIs (social-pull, daily cron) or CSV imports. Read through social_overview() and social_range().';
comment on column public.social_daily.metric is 'Metric name, such as views, reach, engagement, followers, new_followers, likes, comments, shares, saves, sessions, users, pageviews.';
comment on column public.social_daily.source is 'api or csv.';

comment on table public.social_posts is 'Published social posts and their performance metrics, from the APIs or CSV imports (social-pull). Incoming data; content_posts is the outgoing calendar.';
comment on column public.social_posts.kind is 'Post type: post, feed, reels, page (GA4 pages) or video.';
comment on column public.social_posts.raw is 'JSON of extra fields from CSV imports (ctr, audience, post_type, engagement_rate, posted_by, video_views).';
comment on column public.social_posts.source is 'api or csv.';

comment on table public.social_notes is 'AI-written insight notes on social performance (social-pull, weekly cron).';
comment on column public.social_notes.kind is 'Type of note (insights).';
comment on column public.social_notes.data is 'JSON {evidence, recommendations, days} behind the note.';

comment on table public.wa_brand is 'Welfare Avenue brand tokens and rules (Welfare Avenue Brand Guides v1 2026). Seeded 24/09/26. Public read, admins write. category: colour | colour_rule | tint | font | type_scale | type_rule | logo | logo_rule | identity | pillar | personality | archetype | persona | voice | voice_term | messaging | doodle | doodle_principle | doodle_rule | e_that_moves | application | fun_fact | css | tokens.';
comment on column public.wa_brand.meta is 'JSON details whose keys depend on category (for example rgb, cmyk, weight, family, we_say, we_dont_say).';

comment on table public.wa_brand_assets is 'Welfare Avenue brand asset registry (logos, E component, doodles). kind: logo_primary | logo_secondary | logo_lockup | e_component | doodle. Files live in Storage at storage_bucket/storage_path; inline_svg and data_uri let the hub render without the upload. Seeded 24/09/26. Public read, admins write.';
comment on column public.wa_brand_assets.usage is 'Plain-language usage rule for the asset.';

comment on view public.wa_brand_assets_list is 'wa_brand_assets without the heavy inline_svg and data_uri columns (has_inline_svg and has_data_uri say whether they exist). Runs with the caller''s rights since wave133.';

comment on table public.wa_photos is 'Welfare Avenue photo library: labels, usage guidance and storage paths (content-images/photos/). usage: ready | crop (crop the named edge first) | consent (a community member or child is identifiable) | internal | check (not reviewed yet). Staff write; admins delete.';
comment on column public.wa_photos.people is 'Who is in the photo, by role, never by name.';
comment on column public.wa_photos.focal_x is 'Horizontal focal point, 0 to 1, for cropping (focal_y is vertical).';
comment on column public.wa_photos.version is 'Cache-busting version appended to the public URLs.';

comment on view public.wa_photos_list is 'wa_photos plus public URLs for the full, web and thumbnail sizes (url_full, url_web, url_thumb). Runs with the caller''s rights.';

comment on table public.wa_drive_docs is 'Index of Google Drive files visible to the Hub''s service account, with the text of Google Docs (up to 80,000 characters). Synced daily by drive-pull; read by Ask the Hub and the page. Readable by welfareavenue.com accounts and one hardcoded personal address.';
comment on column public.wa_drive_docs.text_content is 'Extracted text for Google Docs and text files; NULL for other formats.';
comment on column public.wa_drive_docs.modified_time is 'Drive modified time; unchanged docs keep their stored text.';

-- ---------------------------------------------------------------------
-- Integrations and AI
-- ---------------------------------------------------------------------

comment on table public.ai_routes is 'Model router configuration: one row per AI job (task), with the chain of OpenRouter model ids. Read by the llm edge function; edited in Admin.';
comment on column public.ai_routes.task is 'Job name sent by callers in the x-wa-task header (primary key).';
comment on column public.ai_routes.chain is 'OpenRouter model ids in order: the first is primary, the rest are fallbacks.';
comment on column public.ai_routes.jev is 'True when the job also runs Jev checks.';
comment on column public.ai_routes.max_tokens is 'Unused (NULL in every row).';

comment on table public.ai_calls is 'Log of every AI call made through the llm router: job, caller, requested and actual model, tokens, cost and errors. Rows older than 90 days are deleted daily by the cron job wa-ai-calls-prune. Admins read.';
comment on column public.ai_calls.task is 'ai_routes.task of the job (test calls use other values). No foreign key: this is a log.';
comment on column public.ai_calls.via is 'How the model was chosen: chain, jev or test.';
comment on column public.ai_calls.cost is 'Cost reported by OpenRouter for the call.';
comment on column public.ai_calls.ms is 'Duration in milliseconds.';

comment on table public.wa_health_checks is 'Latest health check per AI service (router_brain, router_cheap, jev), written daily by health-check. Service role only.';

comment on table public.wa_rate_limits is 'Short-lived rate-limit counters (per IP and action) for the public inventory share link (inventory-share). Rows are deleted when their window ends. Service role only.';

comment on table public.hub_knowledge is 'Knowledge articles given to Ask the Hub as background (read by the ask edge function). One row today.';

comment on table public.clickup_sources is 'ClickUp folders mapped to teams for the weekly ClickUp snapshot (clickup-pull).';
comment on column public.clickup_sources.id is 'ClickUp folder id.';
comment on column public.clickup_sources.department is 'Team code, or split-mtl-to (a rule: split the folder''s lists between opsmtl and opsto by list name).';

comment on table public.clickup_weekly is 'Weekly ClickUp snapshot per team (clickup-pull, Mondays): tasks created and closed that week and open tasks by status.';
comment on column public.clickup_weekly.week_start is 'Monday of the week.';
comment on column public.clickup_weekly.status_counts is 'JSON object: raw ClickUp status label to count. Labels vary by list and are not normalised.';

comment on table public.slack_sources is 'Slack channels read by slack-pull, mapped to teams.';
comment on column public.slack_sources.name is 'Channel name without the # (primary key).';
comment on column public.slack_sources.department is 'Team code, or NULL for organisation-wide channels.';

-- ---------------------------------------------------------------------
-- System
-- ---------------------------------------------------------------------

comment on table public.app_config is 'Key-value text settings and small job state used by edge functions and the page. Keys include site_url, github_repo, netlify_site_id, slack_digest, slack_last_pull (job state), quo_phone_number_id (cache), wa_writing_style, onboarding_email_template, review_channel_id, review_channel_name, agenda_slack_policy, drive_source_links. Staff read and write; board viewers read. Compare hub_settings (JSON values).';

comment on table public.hub_settings is 'Key-value JSON settings edited in the Hub. Keys: team_inbox (Slack channels per team), fund_goals, hours_minimums, inventory_share (share link token and expiry), board ({terms, source, cadence}); social-publish also reads content_calendar. Any staff member can write. Compare app_config (text values).';
comment on column public.hub_settings.value is 'JSON value; the shape depends on key.';

comment on table public.staff_notes is 'Tiny staff-only key-value store (k, v) read by the volunteer messaging screen. Its value is sensitive: never copy it into prompts, logs or messages.';
comment on column public.staff_notes.k is 'Key.';
comment on column public.staff_notes.v is 'Value (plain text).';

comment on table public.info_links is 'Important links, folders, videos and shared logins shown on the Important info page, optionally per team. Staff read and write; hub-edit proposes changes for admins.';
comment on column public.info_links.kind is 'password, video, folder or link (CHECK).';
comment on column public.info_links.username is 'Login name for kind = password.';
comment on column public.info_links.secret is 'For kind = password: the shared login. Sensitive: never copy it into prompts, logs or messages.';
comment on column public.info_links.department is 'Team code, or NULL for everyone.';

comment on table public.change_log is 'Audit trail of changes made in the Hub (one row per changed field) plus run logs written by scheduled jobs. Staff read it; board_only rows only for board_circle.';
comment on column public.change_log.entity_type is 'What changed. Tasks appear as dept_task or task, roster rows as member or team_member; job runs use types such as site_deploy, hours_pull, db_backup, drive_pull, calendar_sync, edge_function, repo_sync.';
comment on column public.change_log.entity_id is 'Id of the changed row as text; for job runs a date or label.';
comment on column public.change_log.changed_by is 'Who made the change: an email, a display name, ''AI: <transcript title>'', or a job label such as db-backup v1.';
comment on column public.change_log.board_only is 'When true, only board_circle members can read the row.';

comment on table public.site_files is 'The built Hub page stored in parts: path index.html in about 380 KB parts (part 1, 2, ...) plus _headers (security headers). The site edge function serves it and host-sync deploys it. Service role only.';
comment on column public.site_files.part is 'Order of the part within the file.';

-- ---------------------------------------------------------------------
-- Backups and leftovers (candidates for removal)
-- ---------------------------------------------------------------------

comment on table public.sop_template_backup_20260802 is 'Frozen copy of sop_template taken on 2 Aug 2026. No primary key, no policies, no code references, not included in the nightly db-backup export. Do not use as live data; candidate for removal.';
comment on table public.transcripts_backup_20260722 is 'Frozen copy of transcripts taken on 22 Jul 2026, with old long team labels. No primary key, no policies, no code references, not in the nightly export. Do not use as live data; candidate for removal.';
comment on table public.wa_loom_stage is 'Empty staging table left from a Loom import. No code references. Candidate for removal.';

-- =====================================================================
-- Functions
-- "Called by" lists the page (build/candidate.html), edge functions, cron,
-- triggers and policies. "Access" gives the EXECUTE grants and the check
-- made inside the function. SECURITY DEFINER functions run as the owner.
-- =====================================================================

-- Access helpers used by row-level security policies and functions

comment on function public.wa_email() is 'The signed-in email in lower case (from auth.jwt()), or an empty string. Access: anon and authenticated.';
comment on function public.my_emails() is 'All emails of the signed-in person: the sign-in email, its dotless spelling and Workspace aliases from hub_directory. Used by calendar_my_meetings(). Access: anon and authenticated.';
comment on function public.wa_my_names() is 'The signed-in email, roster display name and first name in lower case, for matching free-text name columns. Access: anon and authenticated.';
comment on function public.wa_name_matches(cand text) is 'True when a free-text name or email refers to the signed-in person (email, full roster name, or a first name that is unique among active members). Used by policies on agendas and mentions and by wa_sees_restricted(). Access: anon and authenticated.';
comment on function public.wa_actor_name() is 'Display name of the signed-in person from team_members (falls back to the email). Written into *_by columns by the bank and org functions. Access: authenticated.';
comment on function public.is_wa_staff() is 'True for staff: an email with a non-blocked role in hub_roles, or any welfareavenue.com email not blocked. The main check in staff policies. Called by photo-library. Access: authenticated.';
comment on function public.is_hub_admin() is 'True when the signed-in email has role admin in hub_roles. Same check as is_wa_admin() (alias). Called by llm, photo-library, shoutouts and social-pull. Access: anon and authenticated.';
comment on function public.is_wa_admin() is 'True when the signed-in email has role admin in hub_roles. Same check as is_hub_admin() (alias). Access: anon and authenticated.';
comment on function public.is_hub_leader() is 'True when the signed-in email has role admin or leader in hub_roles. Same check as is_wa_leader() (alias). Access: anon and authenticated.';
comment on function public.is_wa_leader() is 'True when the signed-in email has role admin or leader in hub_roles. Same check as is_hub_leader() (alias). Access: anon and authenticated.';
comment on function public.wa_is_hr() is 'True when the signed-in email is in wa_hr_access (HR tools). Access: anon and authenticated.';
comment on function public.wa_page_ok(p_tab text) is 'Whether the signed-in person may open a Hub page by its key: true or false from their hub_roles row and access profile pages, or NULL when the profile does not decide (legacy tabs, no profile). Access: anon and authenticated.';
comment on function public.wa_sees_restricted(vis text, ap jsonb, creator text) is 'Row visibility check for restricted meetings: NULL, empty or department is visible to all; leadership to leaders, board circle and board viewers; private to the creator and the names in ap. Admins see everything. Used by policies on dept_tasks, dept_updates, decisions, transcripts and goal_wins. Access: anon and authenticated.';
comment on function public.get_my_role() is 'Coarse role of the signed-in person for the page: staff, board or none. Called by the page at sign-in. Access: authenticated.';
comment on function public.is_board_circle() is 'True when the signed-in email is in board_circle (may see board_only rows). Called by the page and many policies. Access: anon and authenticated.';
comment on function public.is_board_viewer() is 'True when the signed-in email is in board_viewers. Access: authenticated.';
comment on function public.my_board_member_id() is 'board_members.id of the signed-in person (matched on emails, active or adviser), or NULL. Access: anon and authenticated.';
comment on function public.is_board_person() is 'True for directors (board_members), board viewers and board circle members. Access: anon and authenticated.';
comment on function public.wa_board_leader() is 'True for admins, and for leaders whose access profile opens the governance page. Access: anon and authenticated.';
comment on function public.can_see_board() is 'True when the signed-in person may open the board pages: is_board_person() or wa_board_leader(). Access: anon and authenticated.';
comment on function public.wa_can_bank() is 'True for staff who are not viewers; required by the bank functions. Access: authenticated.';
comment on function public.wa_leads_project(p_id bigint) is 'True for leaders and admins, or when the signed-in person is named in projects.leads of the project. Access: authenticated.';
comment on function public.wa_org_editor() is 'True for Hub admins and for people with the executive access profile; required by the org_* functions. Called by the org chart page. Access: authenticated.';
comment on function public.wa_today() is 'Today''s date in America/Toronto. Use instead of current_date (the database runs in UTC). Access: anon and authenticated.';

-- Page calls: the bank (wave132)

comment on function public.bank_list() is 'Everything in the bank for the bank page: banked tasks and projects the caller may see, items back recently, today''s date and whether the caller can bank or leads. Returns empty lists for non-staff. Called by the page. Access: authenticated.';
comment on function public.bank_task(p_id bigint, p_until date, p_note text) is 'Parks an open task and its open subtasks in the bank until p_until (after today, within about three years), with a note. Checks wa_can_bank() and the task''s visibility, then calls bank_task_do(). Called by the page and by the ask edge function (as the signed-in person). Access: authenticated.';
comment on function public.bank_project(p_id bigint, p_until date, p_note text) is 'Parks a project, its sub-projects and their open tasks in the bank until p_until. Only the project''s lead or a leader; team General projects cannot be banked. Called by the page. Access: authenticated.';
comment on function public.bank_add_task(p_department text, p_title text, p_until date, p_note text, p_project_id bigint, p_owner text) is 'Creates a new task directly in the bank for a team (team code required) with a return date. Checks wa_can_bank(). Called by the page. Access: authenticated.';
comment on function public.bank_redate(p_kind text, p_id bigint, p_until date) is 'Changes the return date of a banked task (p_kind task) or project (p_kind project). Projects need their lead or a leader. Called by the page. Access: authenticated.';
comment on function public.bank_unbank(p_kind text, p_id bigint, p_why text) is 'Brings a banked task or project back now, with a reason. Checks wa_can_bank(), visibility, and project lead rights. Called by the page. Access: authenticated.';
comment on function public.bank_undo(p_kind text, p_id bigint) is 'Undoes a bank action within 30 minutes of banking. Called by the page. Access: authenticated.';
comment on function public.bank_task_do(p_id bigint, p_until date, p_note text, p_by text) is 'Internal: banks a task tree without permission checks, logs to change_log and returns the number of tasks banked. Used by bank_task() and apply_transcript_result(). Access: service role only.';
comment on function public.bank_project_do(p_id bigint, p_until date, p_note text, p_by text) is 'Internal: banks a project tree and its open tasks without permission checks. Used by bank_project(). Access: service role only.';
comment on function public.bank_unbank_do(p_kind text, p_id bigint, p_why text, p_by text) is 'Internal: brings a banked task or project back and restores future due dates. Used by bank_unbank(), bank_resurface() and the process-transcript edge function. Access: service role only.';
comment on function public.bank_resurface() is 'Daily job (cron wa-bank-resurface, 10:05 UTC): brings back banked tasks and projects whose date has come, keeping children with a still-banked parent. Access: service role only.';
comment on function public.wa_task_tree(p_id bigint) is 'Internal: the task id and all its descendant subtask ids. Access: service role only.';
comment on function public.wa_project_tree(p_id bigint) is 'Internal: the project id and all its descendant project ids. Access: service role only.';

-- Page calls: the org chart (wave133)

comment on function public.org_add_opening(p_reports_to bigint, p_title text, p_department text, p_status text, p_note text) is 'Adds an open position to the org chart under a seat (or under the executive directors when NULL). Executives and admins only (wa_org_editor()). Logs to change_log. Called by the page. Access: authenticated.';
comment on function public.org_fill(p_id bigint, p_member_id bigint) is 'Puts an active roster member into an open seat. Executives and admins only. Called by the page. Access: authenticated.';
comment on function public.org_move(p_id bigint, p_reports_to bigint, p_department text) is 'Changes who a seat reports to (and optionally its team). Exec seats cannot move; cycles are refused. Executives and admins only. Called by the page. Access: authenticated.';
comment on function public.org_place(p_member_id bigint, p_reports_to bigint) is 'Creates a filled seat for a roster member who is not yet on the chart. Executives and admins only. Called by the page. Access: authenticated.';
comment on function public.org_remove(p_id bigint) is 'Deletes an empty seat; its reports move up to its manager. Executives and admins only. Called by the page. Access: authenticated.';
comment on function public.org_set_reports(p_id bigint, p_reports bigint[]) is 'Sets exactly which seats report to a seat (moving others out). Executives and admins only. Called by the page. Access: authenticated.';
comment on function public.org_update(p_id bigint, p_title text, p_status text, p_note text, p_department text) is 'Edits a seat''s title, status, note and team. Executives and admins only. Called by the page. Access: authenticated.';
comment on function public.org_vacate(p_id bigint) is 'Takes the person off a seat, leaving an open position. Exec seats cannot be vacated. Executives and admins only. Called by the page. Access: authenticated.';
comment on function public.org_is_under(p_node bigint, p_root bigint) is 'True when seat p_node is below seat p_root in the reporting line (used to refuse cycles). Access: authenticated.';
comment on function public.org_label(p_id bigint) is 'Readable label of a seat for change_log text (name and title, or open position). Access: service role only.';

-- Page calls: board, calendar, search, inbox, adoption, analytics

comment on function public.board_home() is 'All data for the board home page in one JSON: the caller''s board seat, goals, the fiscal year window (from 1 October) and board summaries. Returns NULL unless can_see_board(). Called by the page. Access: anon and authenticated.';
comment on function public.board_me() is 'The caller''s board context: {member_id, board, leader, admin}. Called by the page. Access: anon and authenticated.';
comment on function public.calendar_my_meetings(p_from timestamp with time zone, p_to timestamp with time zone) is 'The caller''s own meetings from hub_events between two times (organizer or attendee is one of my_emails()), excluding cancelled events. Staff and board viewers only. Called by the page. Access: anon and authenticated (checks inside).';
comment on function public.search_transcripts(q text) is 'Full-text and substring search over transcripts, ranked, with a snippet and the AI summary. Staff only; board_only transcripts only for the board circle. Called by the page. Access: anon and authenticated (checks inside).';
comment on function public.team_inbox_mail(p_id bigint, p_state text, p_assignee text, p_request_id bigint, p_clear_assignee boolean, p_by text) is 'Updates the team inbox state of a hub_mail row: state open, done or request, assignee, linked request; logs to change_log. Staff only. Called by the page. Access: anon and authenticated (checks inside).';
comment on function public.hub_adoption() is 'Adoption statistics for Admin: people, visits, hours, tasks, AI calls and cost, questions, transcripts and emails for today, 7 and 30 days. Admins or service role only. Called by the page. Access: anon and authenticated (checks inside).';
comment on function public.wa_hub_logins() is 'Last sign-in and account creation time per auth user (lower-case email). Staff only. Called by the page (HR centre). Access: anon and authenticated (checks inside).';
comment on function public.social_overview(p_days integer) is 'Social and web analytics for the last p_days compared with the previous period: accounts, totals, daily series, top posts, followers and the latest insight note. Staff, board viewers or service role. Called by the page and social-pull. Access: anon and authenticated (checks inside).';
comment on function public.social_range(p_from date, p_to date) is 'Same as social_overview() for any date range (with automatic bucketing and the previous period). Staff, board viewers or service role. Called by the page. Access: authenticated.';
comment on function public.ai_usage(days integer) is 'AI usage per job over the last N days from ai_calls: calls, successes, average time, cost, tokens and models. Called by the llm edge function for Admin. Access: service role only (since 26/09/26).';

-- Page calls: volunteering and SOP run-sheet

comment on function public.volunteer_confirm_get(p_token text) is 'Public confirmation page: returns the volunteer''s name, role and event for a roster confirmation token, or NULL. Meant for anyone holding the link. Called by the page. Access: anon and authenticated.';
comment on function public.volunteer_confirm_submit(p_token text, p jsonb) is 'Public confirmation page: saves the answers (p.attending yes or no) for a roster token and sets confirm_status and status. Meant for anyone holding the link. Called by the page. Access: anon and authenticated.';
comment on function public.volunteer_history() is 'Per volunteer: events rostered, confirmed, unavailable and waiting, last event, last confirmed event and roles. Staff and board viewers only. Called by the page. Access: anon and authenticated (checks inside).';
comment on function public.volunteer_merge(p_keep bigint, p_drop bigint) is 'Merges a duplicate volunteer into another: moves roster rows and Quo messages, combines contact fields, deletes the duplicate and logs to change_log. Staff only. Called by the page. Access: anon and authenticated (checks inside).';
comment on function public.sop_step_insert(p_anchor text, p_mode text, p_name text, p_owner text, p_help text, p_desc text) is 'Adds a run-sheet step to sop_template: a new section (p_mode section), a child of p_anchor (child) or a step after p_anchor (after). Returns the new id. Runs with the caller''s rights (staff policy). Called by the page. Access: anon and authenticated.';
comment on function public.sop_step_move(p_id text, p_dir integer) is 'Moves a run-sheet step and its children among its siblings: down when p_dir is positive, otherwise up. Runs with the caller''s rights. Called by the page. Access: anon and authenticated.';
comment on function public.sop_step_deactivate(p_id text) is 'Deactivates a run-sheet step and all its children (active = false); returns how many. Runs with the caller''s rights. Called by the page. Access: anon and authenticated.';
comment on function public.ensure_event_steps(p_event_id bigint) is 'Copies any missing active run-sheet steps to one event''s checklist; returns rows added. Runs from the trigger trg_event_steps and from sop_sync_all_events(). Access: service role only.';
comment on function public.sop_sync_all_events() is 'Runs ensure_event_steps() for every service event. Called by the sop-import edge function. Access: service role only.';
comment on function public.sop_phase_due(p_phase text, p_event date) is 'Due date for a run-sheet phase: t_minus_2w = event minus 14 days, t_minus_1w minus 7, week_of minus 3, event_day, post_event plus 3; NULL otherwise. Access: anon and authenticated.';

-- Page calls: onboarding and usage

comment on function public.onboarding_assign(p_member_id bigint, p_by text) is 'Starts an HR onboarding plan for a roster member: creates the onboardings row, copies the onboarding_template steps with due dates, and copies the hr_setup_template steps. p_by is stored as given. Staff only (checked inside). Called by the page (HR centre). Access: authenticated.';
comment on function public.onb_due(p_section text, p_start date) is 'Due date for an onboarding section: WEEK 1 = start plus 7 days, WEEK 2 plus 14, WEEK 3 plus 21, WEEK 4 plus 28, 60 DAYS plus 60, otherwise plus 90. Access: anon and authenticated.';
comment on function public.wa_usage_visit() is 'Adds one visit for the signed-in email today in wa_usage. The page calls it without await, so it never runs; superseded by hub_visits. Access: anon and authenticated.';
comment on function public.wa_usage_beat(p_seconds integer) is 'Adds up to 600 seconds of time for the signed-in email today in wa_usage. Never runs (see wa_usage_visit). Access: anon and authenticated.';

-- Edge function and cron calls

comment on function public.apply_transcript_result(p_transcript_id bigint, p jsonb, p_changed_by text) is 'Applies the AI result of one transcript: maps the transcript''s team, then writes dept_meta (read, progress, priorities), new tasks (with assignees, banking far-off ones), closed tasks, updates, new and decided decisions, and marks the transcript processed. p keys: read, progress, priorities, summary, new_tasks, close_task_ids, new_updates, new_decisions, decide_decisions. Called by process-transcript. Access: service role only.';
comment on function public.get_secret(secret_name text) is 'Reads a secret from Supabase Vault by name. Called by almost every edge function (tokens, WA_TRIGGER_SECRET). Access: service role only.';
comment on function public.call_edge(fn text, payload jsonb) is 'Calls an edge function over pg_net with the anon key and the vault WA_TRIGGER_SECRET header; returns the request id. Used by cron jobs and triggers. Access: service role only.';
comment on function public.wa_notify_call(payload jsonb) is 'Calls the notify edge function through call_edge(), ignoring errors. Used by the trg_wa89_* triggers. Access: service role only.';
comment on function public.wa_backup_tables() is 'Names of the public tables the nightly db-backup job exports (all except names containing backup or starting wa_stage). Called by db-backup. Access: service role only.';
comment on function public.extract_speakers(p_body text) is 'Speaker names found at the start of transcript lines (such as Name: or 00:12 Name:), minus common headings; up to 15. Used by the trigger transcripts_set_speakers. Access: anon and authenticated.';
comment on function public.wa_fix_names(s text) is 'Replaces known misspellings and long forms of specific people''s names with their roster display names. A hardcoded list; an alias table would be data instead of code. Access: anon and authenticated.';

-- Trigger functions

comment on function public.set_task_closed_at() is 'Trigger on dept_tasks: sets closed_at when done becomes true and clears it when done is false.';
comment on function public.wa132_bank_close() is 'Trigger on dept_tasks: when a banked task is closed, clears the bank columns and restores due_date from bank_due.';
comment on function public.trg_wa89_task_reassigned() is 'Trigger on dept_tasks: notifies (notify) the new owner when an open task''s owner text changes.';
comment on function public.trg_wa89_request_filed() is 'Trigger on dept_requests insert: notifies (notify) that a request was filed.';
comment on function public.trg_wa123_request_new() is 'Trigger on dept_requests insert: tells team-inbox to post the new request to the team''s Slack channel.';
comment on function public.trg_wa123_request_update() is 'Trigger on dept_requests update: tells team-inbox when status, done or assignee changes.';
comment on function public.trg_wa123_note_new() is 'Trigger on request_notes insert: tells team-inbox about the new note.';
comment on function public.trg_wa123_mail_filed() is 'Trigger on hub_mail: when an email is filed to a team (not noise, not a test), tells team-inbox.';
comment on function public.trg_wa89_mentioned() is 'Trigger on mentions insert: notifies (notify) the person mentioned.';
comment on function public.trg_wa89_suggestion_accepted() is 'Trigger on request_suggestions: notifies (notify) when a suggestion moves from pending to accepted.';
comment on function public.trg_wa89_invited() is 'Trigger on team_members: notifies (notify) when a member is added active or re-activated.';
comment on function public.wa133_roster_sync() is 'Trigger on team_members: puts a new or re-activated staff member (not board) on the org chart under their team head.';
comment on function public.wa_auto_profile() is 'Trigger on hub_roles and team_members: when hub_access_settings.auto_profile is on, gives members and leaders without a profile the access profile of their team.';
comment on function public.wa72_founder_guard() is 'Trigger on hub_roles: keeps the founders'' rows as admin and prevents deleting them (founder emails are hardcoded).';
comment on function public.on_transcript_insert() is 'Trigger on transcripts insert (every row): posts the new transcript id to the process-transcript edge function.';
comment on function public.wa65_on_leadership_insert() is 'Trigger on transcripts insert, only when department contains leadership: sends the row to the process-leadership edge function.';
comment on function public.transcripts_set_speakers() is 'Trigger on transcripts: fills speakers from the body with extract_speakers().';
comment on function public.wa_stamp_restricted() is 'Trigger on transcripts: when a restricted meeting (leadership or private) is processed, copies its visibility and allowed_people to the updates, tasks and decisions it created, found by the text ''AI: <title>'' in added_by or updated_by.';
comment on function public.wa69_general_link() is 'Trigger on transcripts: when processed, moves the tasks it created (found by updated_by = ''AI: <title>'') without a project into the team''s General project.';
comment on function public.trg_event_steps() is 'Trigger on volunteer_events insert: copies the run-sheet steps to new service events (ensure_event_steps()).';
comment on function public.volunteer_event_date_moved() is 'Trigger on volunteer_events: when event_date changes, recomputes the due dates of the event''s run-sheet steps.';
comment on function public.sop_template_propagate() is 'Trigger on sop_template: copies new active steps to planned future events and pushes default owner and phase changes to their open steps.';
comment on function public.onboarding_template_propagate() is 'Trigger on onboarding_template: adds new or re-activated steps to active onboarding plans and removes deactivated ones.';
comment on function public.tg_onbtmpl_touch() is 'Trigger on onboarding_template: sets updated_at when the name or description changes (used to ask people to re-acknowledge).';
comment on function public.hr_setup_propagate() is 'Trigger on hr_setup_template: adds new or re-activated steps to active onboarding plans and removes deactivated ones.';
comment on function public.on_onboarding_help() is 'Trigger on onboarding_help insert: posts the help request to the notify edge function.';
comment on function public.task_files_stamp() is 'Trigger on task_files: records the signed-in email in by_email, whatever the request says.';
comment on function public.wa_photos_touch() is 'Trigger on wa_photos: sets updated_at on every update.';

-- added with the wave134 structure (26/09/26)
comment on column public.request_suggestions.target_request_id is 'References dept_requests.id (the request a suggestion would update). Foreign key (on delete set null).';
comment on column public.hub_shoutouts.member_id is 'References team_members.id. Foreign key (on delete set null).';
comment on column public.dept_meta.label is 'Full team name as the Hub shows it (Operations Montreal, Program Development, Operations Toronto, Marketing, Branding & Web, Fundraising & Finances, Human Resources, Board & Governance).';
comment on column public.dept_meta.short_label is 'Short team name for chips and tight spaces (Ops Montreal, Program Dev, Ops Toronto, Marketing, Fundraising & Finances, HR, Board).';
comment on column public.dept_meta.sort is 'Menu order of the team (1 = first).';
comment on column public.dept_meta.color is 'Team colour (hex) used for dots, chips and columns.';

commit;
