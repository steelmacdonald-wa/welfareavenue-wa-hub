# 18/11/26 - wave353: the goals ecosystem (Strategy app)

Status: live 18/11/26. Database: migrations wa353a_goals_schema and wa353b_goals_data. Page: index.html f4d5b05099c49e509c1a5a138e8942d5
(was 802da183f9ecfbe044ea915284d83c4c; backup in site_files_bak_wa353, RLS on, no public access).
Deploy route (no public stage table): the patch as an ops list (build/parts353/w353_ops.json, from patch353_ops.py) was pushed to
the branch, read into the database through repo-sync's get (call_edge), and applied in one guarded DO block: live md5 check, each
anchor unique, result md5 and part md5s checked before site_files was written, then host-sync and a curl md5 check.
Undo: build/data/wa353_undo.sql. Rebuild on the live page: python3 build/parts353/patch353.py <live index.html> <out>.

Steel's decisions (17/11/26): Key events; FY27 to FY29 on view, SMART unchanged; co-EDs own, leads contribute; ship when tests pass.

Page: live measures per goal (wa353_measures, goal_measures); year bubbles with this year's quarters (checkpoint plus
milestones per quarter, goal_milestones.quarter); live numbers on milestones with "mark it done"; Key events
(fund_events.goal_id, milestone_id); contributors (goal_contributors); a project moves many milestones
(project_milestones), with a milestones card, next up, timeline and CSV report on the project page; a milestone reached
pops, bursts, fills its year's ring and toasts where the year stands. Reduced motion: no movement.

Data (wa353b): owners per the co-ED model; contributors; FY27 milestones from the 10 Nov leadership meeting and the
16 Nov session; Key events linked to goal 4 plus new events; new projects and event sub-projects; goal 3 measures the
community that comes back; goal 5's confidential wording replaced and its history rows removed.

Tests: w353drive 39/39; w205drive 90/1 and w207drive 115/3: the "menu shows once" check, which fails on the live page with the
old tests too.

Live numbers on the day: meals 189, servings 6, people on the tally 109, followers 2,494, community that comes back 40
(returning volunteers 31), returning donors 5, repeat email readers 4 (email opens are tracked), monthly donors 0, gifts a month
(6-month average) $598, projects serving a goal 94%, open tasks past due 104.
