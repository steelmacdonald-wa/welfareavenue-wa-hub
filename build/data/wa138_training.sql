-- wave138 (26/09/26): the Avenue Academy teaches @mentions (Hub module 2: department pages, tasks and projects).
-- Adds one paragraph before "Try it" and one skill to "Done when"; runs once (skips if the lesson already says @mention).
update public.trainings
  set description = replace(
        replace(description,
          E'\n\nTry it: open your department page',
          E'\n\nTo bring someone in, type @ and their name in a task comment or description, a goal comment, a request note, a team update, a decision, a project description or the notes of a Content calendar post, and pick them from the list. They get a Slack message with what you wrote and a link straight to it. Connect Slack under Settings, Connections (Send @mentions as you) and the message comes from you; until then it comes from the Hub with your name. A mention in a confidential or board-only item tells them where to look, without the text.\n\nTry it: open your department page'),
        'Done when: you can add, assign, project-link, bank and close a task.',
        'Done when: you can add, assign, project-link, bank and close a task, and bring someone in with @.'),
      updated_at = now()
  where id = 40
    and position('@mention' in description) = 0
    and position(E'\n\nTry it: open your department page' in description) > 0
    and position('Done when: you can add, assign, project-link, bank and close a task.' in description) > 0;
