# 18/11/26 - wave353: the goals ecosystem (Strategy app)

Status: built and tested, not live. The Supabase connection asks Steel to approve each migration; two approvals timed out.
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

Tests: w353drive 39/39; w205drive 90/1, w207drive 115/3, w206drive 130/4, the same failures as the live page.
