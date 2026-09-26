-- wave135 (26/09/26): the Training academy is the Avenue Academy, and learning paths are Learning Avenues.
-- Steel: "Change Training Academy to Avenue Academy and Learning Paths to Learning Avenues"
-- Display text only: the page id (#training), the tables academy_paths and academy_awards, and the
-- tour key tour:academy keep their names, so links, progress and certificates carry on.

-- 1. the academy's own rows
update public.trainings
  set title = 'Page tour: Avenue Academy',
      description = replace(description, 'Onboarding, paths, tours,', 'Onboarding, Learning Avenues, tours,'),
      updated_at = now()
  where key = 'tour:academy' and title = 'Page tour: Training academy';
update public.trainings
  set description = replace(replace(replace(description,
        'The Training academy starts with', 'The Avenue Academy starts with'),
        'learning paths with a certificate at the end', 'Learning Avenues with a certificate at the end'),
        'take the tour of the academy itself', 'take the tour of the Avenue Academy itself'),
      updated_at = now()
  where id = 45 and description like '%The Training academy starts with%';
update public.trainings
  set description = replace(description, 'Knowledge path on the MG&Co', 'Learning Avenue on the MG&Co'), updated_at = now()
  where id = 23 and description like 'Knowledge path on the MG&Co%';
update public.trainings
  set body = replace(body::text, 'The growth strategy deck in the academy came from it.', 'The growth strategy deck in the Avenue Academy came from it.')::jsonb,
      updated_at = now()
  where id = 52 and body::text like '%The growth strategy deck in the academy came from it.%';

-- 2. access profiles: what leaders and executives can do
update public.hub_access_profiles
  set lead_note = replace(lead_note, 'can add trainings to the academy.', 'can add trainings to the Avenue Academy.'),
      updated_by = 'Hub release (wave135)', updated_at = now()
  where lead_note like '%can add trainings to the academy.%';
update public.hub_access_profiles
  set can = replace(can::text, 'Add and assign trainings in the academy', 'Add and assign trainings in the Avenue Academy')::jsonb,
      updated_by = 'Hub release (wave135)', updated_at = now()
  where can::text like '%Add and assign trainings in the academy%';

-- 3. Important info: the course login's note
update public.info_links
  set notes = replace(notes, 'in the Training academy', 'in the Avenue Academy'), updated_at = now()
  where id = 14 and notes like '%in the Training academy%';

-- 4. the schema names both, so agents and developers can match either
comment on table public.trainings is 'Training catalogue (wave122): Loom videos, reads, documents, SOP lessons, lessons with quizzes and Hub page tours. Written by the Avenue Academy pages (page #training; called the Training academy before wave135) and tour seeds.';
comment on column public.trainings.path_group is 'The Learning Avenue (called a learning path before wave135) the training belongs to, stored as academy_paths.name (not the path key).';
comment on table public.academy_paths is 'Learning Avenues (called learning paths before wave135) shown in the Avenue Academy (page #training). Trainings join an avenue by trainings.path_group = academy_paths.name. Leaders write; staff read.';
comment on column public.academy_paths.name is 'Learning Avenue name; the join value used by trainings.path_group (unique).';
comment on column public.academy_paths.dept is 'Team code of a team Learning Avenue, NULL for organisation-wide ones.';
comment on column public.academy_paths.required is 'True for Learning Avenues every staff member must complete.';
comment on table public.academy_awards is 'Badges, levels and certificates earned in the Avenue Academy (the Training academy before wave135), celebrated once. Unique by (person_name, award).';

-- 5. the audit trail
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values
  ('hub', 'wave135', 'rename', 'Training academy; learning paths', 'Avenue Academy; Learning Avenues (menu, page, help, tours, access labels, academy rows)', 'Hub release (wave135)'),
  ('training', 'tour:academy', 'title', 'Page tour: Training academy', 'Page tour: Avenue Academy', 'Hub release (wave135)'),
  ('access_profile', 'executive, hr, marketing, fundraising, progdev, opsmtl, opsto', 'can and lead_note', 'trainings in the academy', 'trainings in the Avenue Academy', 'Hub release (wave135)');
