# 26/09/26 - wave145: Forms flows

Live md5 `2a34a0b4380eb9509c353b8f8a2e7fdb` (4,045,415 bytes), deployed through the gated pipeline in three steps (`wa_stage_rp`, then two small follow-ups through `wa_stage_rq` and `wa_stage_rr`, each guarded on the live md5 before it and dropped after). Data: migrations `wa145_forms` (the tables, the rules and the five forms) and `wa145_forms_cron` (the run every six hours, the access profiles and Hub modules 6 and 7). Function: `forms-flow` v6 (new). Page: segment `145_wave145`.

## What Steel asked

"go for all the above": the Google projects the delegated access opened. This is the third, Forms flows.

## What the Drive holds

46 Google Forms. Five still get answers and now flow into the Hub; the rest are dormant (old event registrations, member of the month, end of year forms, drafts).

| Form | Answers | Where it goes |
|---|---|---|
| Volunteer Survey (after each serving) | 60 since February, 24 in the last 90 days | The serving it follows, in the Volunteering manager |
| Weekly Audit and Restock Form | 11 | The serving of its event date |
| Welfare Avenue Recurrent Volunteers Program | 20 | The volunteer list |
| Policy Quiz | 43 | The onboarding step "Policy quiz" |
| Week 4 Onboarding / Training Quiz (the 30 day quiz) | 11 | The onboarding step "30 day quiz" |

The two quizzes were matched to their onboarding steps by the links in the steps (their published form ids). Job applications have no Google Form: they come by email and the Hub inbox already files them as candidates.

## What the Hub does with each answer

- **The volunteer survey**: each answer goes on the latest serving in the six days before it. Once a serving has two answers, the router writes a short summary (how volunteers found it, what beneficiaries needed, what slowed service, the suggestions worth acting on), rewritten only when the number of answers changes.
- **The event audit**: on the serving of its EVENT DATE.
- **The recurrent volunteers form**: someone already in the volunteer list (same email or phone) gets their last applied date and any new role; someone new is added for review (the review flag, with what they signed up for and how often). Sign-ups older than a year only update known volunteers.
- **The quizzes**: matched to the person by their Google account, else their name. When their onboarding is in progress, the step is ticked with the score ("Google Form: Policy quiz (19 of 19)"). A recent answer that matches no one, or no onboarding yet, is tried again for thirty days.
- Every answer is stored once as question and answer text; what the Hub did is recorded with it, so nothing happens twice.

## What the Hub shows

- **Each serving** (Volunteering manager, the event page, side rail): **What volunteers said** (the summary, each choice question counted, the suggestions, the contacts volunteers left for future opportunities) and the link to send volunteers the survey (open it or copy it), then the **Event audit** (standards met, what was not met, low stock, damage, meals served, the lead's comments).
- **The Volunteering calendar**: the four latest servings with answers and their summary's first line, the new sign-ups waiting for review, and the survey link.
- **The HR centre** (HR, the executive directors and admins): **Onboarding quizzes**: who took which quiz, the graded score, whether the Hub ticked their step, and what new members said about the onboarding.
- Admins, leaders and the Executive profile can read the forms now (Read the forms now, Sync now); otherwise every six hours.

## Who reads what

The volunteering forms are read like the volunteer list (staff). A quiz is read by the HR access list, the executive directors and admins, and the person who took it. Directors and anyone outside Welfare Avenue read nothing.

## The first run (26/09/26)

The volunteer survey: 58 of 60 answers on ten servings, ten summaries. The event audit: one of eleven on a serving (the others are from 2025, before the Hub's serving records). The sign-ups: eight known volunteers updated, three new ones added for review, nine older than a year not added. The quizzes: 27 of 54 answers matched to someone on the roster; nobody with an onboarding in progress has taken one yet (the two onboardings started on September 25).

## How it works underneath

- `fn/forms-flow/index.ts`: `questionsOf()` and `answersOf()` turn a form and its responses into question and answer text (grid rows as "Grid: row"); the event match, `signups()`, `quizzes()` and `summaries()` (three at a time, newest first, within about a minute and a half; the rest wait for the next run). `status` lists the forms; `sync {form_id?, dry?}` reads them.
- `145_wave145.seg`: `load()` reads the three tables (paged); `paintEvent()` puts the two cards in `#w119rail`, `paintHome()` after `#w119cal`, `paintHR()` after the Meeting attendance card; MutationObservers put them back when the pages repaint; tour steps on the volunteering page and the HR centre.

## What the challenge changed

- The first run timed out: the router summaries (about fifteen seconds each) ran first, one by one. They now run last, three at a time, within a time budget.
- The sign-up form would have added nine people who signed up more than a year ago. Only the last year adds people now.
- A quiz from someone not yet on the roster, or taken before their onboarding was set up, would have been closed for good. Recent answers are tried again for thirty days.
- The audit card listed twenty standards one by one. It now says how many were met and names the ones that were not.
- An HR member outside the HR access list read "No quiz answers yet". They now read who keeps the results, and Sync now shows only to the people the function accepts.

## Things to look at (not changed by the Hub)

- **The Volunteer Survey belongs to Amena Diab's account**, which is not on the roster. If that account is closed, the form and its answers go with it: move it into the Operations shared drive, or transfer it to an active account. The recurrent volunteers form belongs to Ahmed's account; a shared drive would be safer too.
- The servings of August 23 and September 6 still say "planned" although volunteers answered the survey for both.
- The 30 day quiz grades five questions; the rest are written answers HR reads in the form.

## Release checklist

- **Access:** three new tables with the rules above; the Executive, HR and Operations Montreal profiles say what they see.
- **Training:** the volunteering tour (two steps) and the HR centre tour (one step); Hub module 6 (the volunteering manager) says how to send the survey and where answers land; Hub module 7 (training and onboarding) says the quizzes tick their steps.
- **Security review:** one new function (trigger secret, or a signed-in leader, HR person or admin); the Forms API through the delegated drive scope (read only); volunteer contacts stay in staff-only rows; quiz answers stay with HR.
- **Tests:** `test/w145drive.js` (20 checks: the calendar card, the four servings, the sign-ups, the survey link, the tours, a serving's feedback with its summary and counts, the audit, Read the forms now, the HR quiz table and scores, the new members' words, Sync now, a staff member, an HR member outside the access list, no page errors). The live-versus-candidate harness differs only by known timing noise (the harness data has no forms). Row level security checked as an HR member, an admin, a leader, a director and a stranger.
