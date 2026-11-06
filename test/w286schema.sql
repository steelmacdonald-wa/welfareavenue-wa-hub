-- wave286: fixture rows for the offline proof of build/data/wa286_vm_chapter.sql (Toronto crews in the CRM) in test/w286sql.mjs (PGlite), loaded
-- after test/w281schema.sql and build/data/wa281_rules.sql (so wave281's chapters and its evidence backfill are in place). The tables wave286 reads
-- (volunteer_events, event_roster, crm_contacts, crm_contact_chapters) are already in that slice with the columns wave286 needs. A Toronto event is
-- wave274's: kind meal, location Toronto, a TO- code; its crew rows carry the contact in detail.contact_id, as wa274_crew_add writes them.
-- Every row is invented (Test ..., example.invalid). Not a copy of live: do not apply it anywhere but the offline PGlite database.

insert into public.hub_roles (email, role, profile) values ('w286.staff@example.invalid', 'member', null);

-- events: two Toronto events, a Montreal serving, and a serving of the Montreal kind held in Toronto (not a Toronto event in wave274's sense)
insert into public.volunteer_events (id, code, event_date, status, kind, location, title) values
  (8611, 'TO-26-1', date '2026-11-21', 'planned', 'meal', 'Toronto', 'Test Toronto meal'),
  (8612, 'TO-26-2', date '2026-11-28', 'planned', 'meal', 'Toronto', 'Test Toronto meal two'),
  (8613, 'WA-26-861', date '2026-11-22', 'planned', 'service', 'Montreal', 'Test Montreal serving'),
  (8614, 'WA-26-862', date '2026-11-29', 'planned', 'service', 'Toronto', 'Test serving of the Montreal kind');

-- people. 8601: on a crew by detail.contact_id; 8602: on a crew by the volunteer record only (on both Toronto events); 8603: already in Toronto
-- (by hand); 8604: merged into 8605, named in a crew row with nobody else to fall back on; 8607: a Montreal server with a montreal row;
-- 8608 to 8611: for the trigger checks in test/w286sql.sql
insert into public.crm_contacts (id, full_name, volunteer_id, emails) overriding system value values
  (8601, 'Test Crew By Contact', 8701, array['w286.8601@example.invalid']),
  (8602, 'Test Crew By Volunteer', 8702, array['w286.8602@example.invalid']),
  (8603, 'Test Crew Already Toronto', 8703, array['w286.8603@example.invalid']),
  (8605, 'Test Kept Contact', 8705, array['w286.8605@example.invalid']),
  (8607, 'Test Montreal Server', 8707, array['w286.8607@example.invalid']),
  (8608, 'Test New Crew', null, array['w286.8608@example.invalid']),
  (8609, 'Test Montreal Volunteer', 8709, array['w286.8609@example.invalid']),
  (8610, 'Test Late Volunteer', 8710, array['w286.8610@example.invalid']),
  (8611, 'Test Moved Volunteer', 8711, array['w286.8611@example.invalid']);
insert into public.crm_contacts (id, full_name, volunteer_id, emails, merged_into) overriding system value values
  (8604, 'Test Merged Crew', null, array['w286.8604@example.invalid'], 8605);
insert into public.crm_contact_chapters (contact_id, chapter, source, source_ref, added_by) values
  (8603, 'toronto', 'hand', 'test', 'w286'), (8607, 'montreal', 'evidence', 'serving', 'w286');
insert into public.event_roster (id, event_id, person_id, person_name, role, status, detail) values
  (8621, 8611, 8701, 'Test Crew By Contact', 'cook', 'TBD', '{"source": "toronto", "contact_id": 8601}'),
  (8622, 8612, 8702, 'Test Crew By Volunteer', 'server', 'TBD', '{}'),
  (8623, 8611, 8702, 'Test Crew By Volunteer', 'driver', 'Confirmed', '{}'),
  (8624, 8611, 8703, 'Test Crew Already Toronto', 'server', 'TBD', '{"source": "toronto", "contact_id": 8603}'),
  (8625, 8611, null, 'Test Merged Crew', 'server', 'TBD', '{"source": "toronto", "contact_id": 8604}'),
  (8626, 8613, 8707, 'Test Montreal Server', 'server', 'Confirmed', '{}'),
  (8627, 8614, 8709, 'Test Montreal Volunteer', 'server', 'Confirmed', '{}'),
  (8628, 8611, null, 'A partner kitchen', 'cook', 'TBD', '{"contact_id": "not a number"}');
