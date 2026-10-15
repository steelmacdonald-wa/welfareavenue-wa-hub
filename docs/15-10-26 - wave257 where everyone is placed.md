# 15/10/26 - wave257: Calendar its own page, where everyone is placed, and placing them

Steel (15/10/26): "the calendar should be its own page. And once you click into a serving on the calendar, it opens this
upcoming serving page." "For the people section ... I can't see what events, upcoming events each individual is signed up
for." "In applicants received, I can't really open ... their profile up and assign them to an event ... when we get the
application, we can assign them to an event and they get the notification on text and email ... please confirm ... we
can have her confirmed early." "For applicants received and volunteers, I should be able to see when their upcoming
volunteering dates are, if they've confirmed to them or not ... it needs to be easier to assign them to events."

## Calendar, its own page

- The Volunteer Manager's rail: Servings > **Servings** (`#volunteering`: This week, the next serving, the upcoming
  servings) and **Calendar** (`#volunteering/calendar`: the month alone, bigger days, each serving with its code and
  "x/18 filled, y to confirm" from wave234's numbers; a click opens the serving page). The classic page's chips: Servings,
  Calendar. Mastheads: "Servings: This week and every upcoming serving", "Calendar: Every serving, month by month".
- Done in CSS from the address (`#volunteering[data-w257="cal"|"home"]`), so wave119's calendar and wave191's This week
  stay as they are.

## Where everyone is placed

- **Volunteers** (`#volunteering/people`): under each name, "Upcoming servings" and a chip per serving (the date, the role,
  where it stands: Confirmed; Signed up, not confirmed (TBD, from a form); Placed, waiting to confirm (assigned by the
  team); Invited, no answer yet; Role to choose (picked two roles, wave244); Can't make it), each opening the serving, or
  "Not on a serving yet". A Placed filter: Everyone, On a serving (n), Not placed yet (n). **Assign** on each row.
- **Applicants received**: the same on each card, and **Assign to servings** (gold).
- Read from `volunteer_events` (upcoming services) and `event_roster` (staff RLS), cached 30 s.

## Assign to servings

- The window (`wa257_assign_options`): the roles (the ones they applied for marked), the next 10 servings with the role's
  open spots (the serving's own spot counts first) and where the person already is (those not confirmed are ticked), a
  role per serving, Tell them (text to their number, email to their address; leaders, HR and admins), from an application
  Mark the application Welcomed, and the preview (`wa257_preview`: the real text and whether the text and email go,
  worked out by placing them inside a block that is rolled back).
- **Place** (`wa257_assign`): a new roster row (Waiting For Response, `detail.source` assigned) or their row moved to that
  role and back to waiting (a confirmed row keeps its answer; `detail.was` keeps the old role and status); every placed row
  gets `detail.confirm_early` (their page offers Confirm at once instead of "we will text you 7 days before";
  `volunteer_confirm_get` patched in place) and `signup_noticed_at` (no second sign-up text). One text (quo_messages kind
  signup, `wa257_text`, English or French: "Good news: you're on the team as a server on Sunday, November 15 ... Please
  confirm you'll be there: <link>"; sms_mode, 9 am to 7 pm, STOP) and one email (mail-send `send`, template
  `volunteer_assigned` / `volunteer_assigned_fr`: the dates, role, time and place, Confirm my servings; mail_mode and the
  permission rule). From an application: `wa209_vol_app_status` welcomed, "Placed on Sun Nov 15 server, ...".
  change_log volunteer_person assigned. The 7-day confirmation still goes to anyone who has not confirmed by then.

## Sophia Labrosse (the example)

She applied on the website on 14/10 (Dishwasher, Server) and picked 15 and 29 November; the form put her on both as a
server, "TBD" (signed up, not confirmed), and the sign-up text went at 9 am on 15/10. Now both show on her card and her
Volunteers row. Assign to servings opens on Server with both ticked; Place sends her one text and one email to confirm.

## Data and release

- `build/data/wa257_assign.sql` (migrations wa257_assign, wa257_assign_email), `build/data/wa257_release.sql` (tour row
  `tour:volcalendar`, change_log release).
- The Hub: `build/src/257_wave257.seg` (new, after 256 in the manifest), `build/parts153/a_head.js` (the rail).
- Live 15/10/26 about 20:05 Toronto: index.html `9803ee6fc062591129729a03ec7efc8c` (on wave256's `3d68e04e`), gated
  deploy (stage wa_stage_257, closed after), host-sync 200, checked byte for byte.
- Tests: test/w257drive.js 24/24; regression on the candidate: w256 30, w209 34, w191 39, w191rec 50, w153 46, w218 27,
  w239 44, w191board 9, w176 14 (its rail check now expects Servings on a serving page). Tour volcalendar 3 of 4 steps
  highlighted (the fourth is a centred note).
- The database functions tried as Steel in rolled-back blocks on Sophia: the preview (2 to confirm, the text, "waits for 9
  am", the email "sends now"), a placement (her 15 November row became Waiting For Response as a dishwasher, its page
  state open, 29 November still early). The email rendered through mail-send preview. Nothing was sent to her.
- Security advisor: no new ERROR.
