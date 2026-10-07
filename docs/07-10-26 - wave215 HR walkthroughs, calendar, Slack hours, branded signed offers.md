# 07/10/26 - wave215: HR walkthroughs, time off on the calendar, Slack hours, branded signed offers

Steel, 07/10/26: a comprehensive walkthrough of the whole HR centre in the Avenue Academy, clicking the real buttons on a practice applicant who is the learner themselves; approved time off on the hub@welfareavenue.com calendar; Slack activity counting toward hours; offer emails tested to his Welfare Avenue address; then "branded similar to how we do our crm emails ... the offer letter ... my signature ... from the volunteer recognition letter section ... my sign off and come in to my inbox (this should be a setting as it may be Suhaib or someone else that needs to sign)".

## What shipped
- Academy path "The HR centre": lesson:hrcentre (11 chapters, 7-question quiz) and seven guided walkthroughs (start, recruitment, onboarding, time off, people, training, policies). The coach rings the next button, moves on when the step is done, and can be resumed.
- Practice records: hub_candidates.practice, wa_timeoff.practice (migration wa215a). wa209_intake accepts practice; wa210_stage_moved skips it; Clear practice on Applications calls wa215_clear_practice.
- Time off: approved requests become all-day events on the hub@ calendar (hr-notify v2, trigger trg_wa215_timeoff_cal).
- Hours: slack_hours added to Loop minutes, shown as "from Slack" (policy slack_hours_read adds wa_can_timeoff(), migration wa215b).
- Offers (recruit-actions v4): a signed PDF in the WA brand, the CRM email layout with the signer's sign-off, a blind copy to the signer, replies to the signer. The signer is app_config offer_signer_email (default Steel), changed in the offer panel by HR or an admin.

## Live
Hub c359b6f1 (07/10/26). Tests: test/w215drive.js 47/47; w211, w209, w199 and the related suites pass (w190 and w192 fail on the earlier live build too).

## Still to do
- Signers save their signature, name and title in Volunteer Manager > Sign-offs > My signature (none saved yet, so letters carry the name only).
- Drop the temporary tables wa_stage_215 and wa_stage_sql215.
