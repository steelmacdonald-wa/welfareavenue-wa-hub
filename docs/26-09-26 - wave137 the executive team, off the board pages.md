# 26/09/26 - wave137: the executive team, off the board pages

Live md5 `b6560e9333bf68a7a9aa3c44a7f65dfc` (3,846,292 bytes), deployed through the gated pipeline (`wa_stage_rh`, guarded on the live md5 `6e207481` and dropped after). Schema: `wa137_exec_team`. Edge function: mail-pull v10.

## What Steel asked

"You should take Suhaib and I out of the board team - we are more part of the executive team. I don't want all our meetings and stuff flooding the board tabs"

## Why the board pages were flooded

A team page counts a calendar event as the team's meeting when two of its members are invited (unless the event is tagged with another team). Steel and Suhaib were both on the Board & Governance team, so every meeting they share (the weekly Ian, Kahkashan and Amanda meeting, Leadership Strategy and Discussion, and so on) showed as a board meeting: 9 in the next 45 days. The Hub inbox did the same with emails either of them sent in.

## What changed

- **Steel and Suhaib are the Executive team**: a label (`exec`) with no team page, so their shared meetings belong to no team. The Board & Governance pages now count only the directors on that team (Kellian, Daniela, Tamara, Mohamed and Rima): none of those 9 meetings remain.
- Their profiles, Home, People and access and the org chart say **Executive team**; on the org chart they stay the executive directors, reporting to the board.
- Three items that were on the board pages move off them: the summaries of two executive one-on-ones (May 17 and July 2) and an invitation email for the weekly Ian, Kahkashan and Amanda meeting.
- **The Hub inbox** (mail-pull v10) no longer files an email under a team because an executive director sent it or is copied on it; the email's content decides, as for anyone outside the teams.
- Both stay **directors** on the Board overview (`board_members` is unchanged), and their access is unchanged (admins).

## Release checklist

- **Access:** unchanged (both are admins; no profile changes). The board team's own access profile and page gates are untouched.
- **Training:** no tour or lesson names who is on the board team.
- **Security review:** data and a label only.

## Verification

- With Steel and Suhaib moved in the test data: the board team page and its agenda show only the directors (no "S S" avatars), Steel's profile, Home and People and access say Executive team, the org chart is unchanged, and no page errors.
- Live: the md5 matches the build; in the database, the untagged meetings that counted as board meetings in the next 45 days went from 9 to 0.
