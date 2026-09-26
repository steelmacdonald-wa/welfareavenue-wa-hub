-- wave132: the academy learns the bank (run after the wave132 deploy)
insert into public.trainings (category, title, description, source, path_group, sort, active, kind, key, body, minutes, xp)
  values ('Hub tours', 'Page tour: The bank', 'Where work that can wait three months or more goes, how it comes back on its own, and how to bring it back early.', 'hub', 'Hub page tours', 34, true, 'tour', 'tour:bank', $j${"tour": "bank", "tab": "bank"}$j$::jsonb, 2, 20)
  on conflict (key) where key is not null do update set title = excluded.title, description = excluded.description, body = excluded.body, minutes = excluded.minutes, path_group = excluded.path_group, sort = excluded.sort, category = excluded.category, kind = excluded.kind, active = true, updated_at = now();

update public.trainings set description = 'One project''s tasks, lead and progress, and how its lead can park it in the bank.', updated_at = now()
  where key = 'tour:project';

-- Hub module 2: tasks that can wait
update public.trainings
  set description = 'Each department page is the live status board: quarterly goals at the top (with wins the AI spotted in meetings), then updates from recent meetings, workstreams and tasks. Add a task with the + button: if the task is for someone in another department it files itself into THEIR department automatically. Tasks link to projects with the project pill, and due dates with the due pill. Nothing is ever deleted: closed tasks keep their history and every change lands in Activity.' || E'\n\n' ||
      'When a task cannot start for three months or more, open it and press Move to the bank: it leaves every board and count, and comes back on its own on the day you pick (a project''s lead can bank a whole project from its page). Everything waiting is under Strategy, The bank.' || E'\n\n' ||
      'Try it: open your department page, add yourself a small task with a due date, then close it.' || E'\n\n' ||
      'Done when: you can add, assign, project-link, bank and close a task.',
    body = $j${"tours": ["team", "tasks", "bank"]}$j$::jsonb, updated_at = now()
  where kind = 'read' and path_group = 'Using the Hub' and title = 'Hub module 2: department pages, tasks and projects';

-- Hub module 3: the AI banks what a meeting puts off
update public.trainings
  set description = replace(description, 'Closing a task needs clear proof from the meeting; re-discussed work becomes a comment on the existing task, not a duplicate.',
      'Closing a task needs clear proof from the meeting; re-discussed work becomes a comment on the existing task, not a duplicate. Work the meeting puts off by three months or more goes straight to the bank, with the reason, and comes back on its date.'),
    updated_at = now()
  where kind = 'read' and path_group = 'Using the Hub' and title = 'Hub module 3: uploading a meeting transcript'
    and description not like '%goes straight to the bank%';
