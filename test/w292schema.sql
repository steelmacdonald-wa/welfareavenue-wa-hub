-- wave292: what build/data/wa292_batches.sql, its undo and the wave292 assertions touch beyond slice 1's files and wave289 (test/w281schema.sql,
-- build/data/wa281_rules.sql, test/w282schema.sql, build/data/wa282_mail_rule.sql, test/w284schema.sql, build/data/wa284_import.sql,
-- test/w289schema.sql, build/data/wa289_scan.sql), for the offline proof in test/w292sql.mjs (PGlite). crm_interactions' row security and its four
-- permissive policies follow live (zwnmulmnvopclzcvytce, read 07/11/26: crm_interactions_delete, _staff_insert, _staff_read, _staff_update).
-- Then one finished email-history run with staged people, messages and organisations. Every row is invented (Test ..., example.org,
-- example.invalid, 555 numbers, gmail ids gm292...). Not a copy of live: do not apply it anywhere but PGlite.

-- 1. crm_interactions as live has it (row security on; staff policies)
alter table public.crm_interactions enable row level security;
create policy crm_interactions_staff_read on public.crm_interactions for select to authenticated using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
create policy crm_interactions_staff_insert on public.crm_interactions for insert to authenticated with check (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
create policy crm_interactions_staff_update on public.crm_interactions for update to authenticated using (public.is_wa_staff() and coalesce(public.wa_page_ok('crm'), true));
create policy crm_interactions_delete on public.crm_interactions for delete to authenticated using (public.is_wa_admin());
create unique index if not exists crm_interactions_source_ref_uq on public.crm_interactions (source, source_ref) where source_ref is not null;

-- 2. Hub contacts the batches meet (4001 Test Existing Writer, 4004 Test Phone Person and 4005 Test Staff Contact come from test/w289schema.sql)
insert into public.crm_contacts (id, full_name, emails, email_status) overriding system value values
  (9301, 'Test Stop Writer', array['stop.writer@example.org'], 'unknown'),
  (9302, 'Test Gone Person', array['gone.person@example.org'], 'unknown'),
  (9303, 'Test Second Holder', array['other.address@example.org', 'gone.person@example.org'], 'unknown');

-- 3. a finished email-history run (both mailboxes done)
insert into public.crm_import_runs (id, label, created_by, source) overriding system value values (9201, 'Test email history run', 'w281.admin@example.invalid', 'email_history');
insert into public.crm_import_runs (id, label, created_by) overriding system value values (9200, 'Test Keela run', 'w281.admin@example.invalid');
insert into public.crm_mail_scans (run_id, mailbox, phase, counts, spend_usd, cap_usd, go_at, finished_at) values
  (9201, 'steel', 'done', '{"run": {"writers": 8, "optouts": 3, "outbound_only": 1, "suppressed": 1}}', 1.2, 10, now() - interval '1 day', now() - interval '1 hour'),
  (9201, 'hub', 'done', '{"run": {"writers": 8, "optouts": 3, "outbound_only": 1, "suppressed": 1}}', 0.8, 10, now() - interval '1 day', now() - interval '1 hour');
insert into public.crm_email_suppressions (addr_md5, kind, at, source) values (md5('suppressed.deleted@example.org'), 'deleted', '2026-01-01', 'Contact deleted');

-- 4. the staged people
insert into import_stage.mail_people (run_id, key, writer, addresses, name, rel_type, rel_conf, lang, sig, domain, general_inbox, counts, first_at, last_at, mailboxes, topics, optout, optout_at, excluded, match_kind) values
  (9201, 'new.writer@neworg.example.org', true, array['new.writer@neworg.example.org'], 'Test New Writer', 'partner', 0.9, 'en',
   '{"title": "Test Director", "organization": "Test New Org", "phone": "514 555 0199", "website": "https://www.linkedin.com/in/test-new-writer"}', 'neworg.example.org', false,
   '{"in": 1, "out": 1, "threads": 1}', now() - interval '3 months', now() - interval '3 months', array['steel'], array['partnership'], null, null, false, 'none'),
  (9201, 'existing.writer@org.example.org', true, array['existing.writer@org.example.org'], 'Test Existing Writer', 'supporter', 0.85, 'fr',
   '{"title": "Test Coordinator"}', 'org.example.org', false, '{"in": 1, "out": 0, "threads": 1}', '2021-05-01', '2021-05-01', array['hub'], array['event'], null, null, false, 'email'),
  (9201, 'info@generalorg.example.org', true, array['info@generalorg.example.org'], 'Info', 'other', 0.4, 'en', null, 'generalorg.example.org', true,
   '{"in": 1, "out": 0, "threads": 1}', '2022-01-10', '2022-01-10', array['hub'], array['other'], null, null, false, 'none'),
  (9201, 'stop.writer@example.org', true, array['stop.writer@example.org'], 'Test Stop Writer', 'other', 0.6, 'en', null, 'example.org', false,
   '{"in": 1, "out": 0, "threads": 1}', '2022-05-01', '2022-05-01', array['hub'], array['other'], 'asked_to_stop', '2022-05-01', false, 'email'),
  (9201, 'gone.person@example.org', false, array['gone.person@example.org'], null, null, null, null, null, 'example.org', false, null, null, null, array['steel'], null, 'bounced', '2021-03-12', false, 'email'),
  (9201, 'left.out@example.org', true, array['left.out@example.org'], 'Test Left Out', 'donor', 0.9, 'en', null, 'example.org', false, '{"in": 1}', '2023-01-01', '2023-01-01', array['hub'], null, null, null, true, 'none'),
  (9201, 'phone.person@example.org', true, array['phone.person@example.org'], 'Test Phone Writer', 'volunteer', 0.7, 'en', '{"phone": "+1 514 555 0177"}', 'example.org', false, '{"in": 1}', '2023-02-01', '2023-02-01', array['hub'], null, null, null, false, 'phone_only'),
  (9201, 'suppressed.deleted@example.org', true, array['suppressed.deleted@example.org'], 'Test Deleted Before', 'donor', 0.9, 'en', null, 'example.org', false, '{"in": 1}', '2023-03-01', '2023-03-01', array['hub'], null, null, null, false, 'none'),
  (9201, 'w289.staff.home@example.invalid', true, array['w289.staff.home@example.invalid'], 'Test Staff Home', 'other', 0.5, 'en', null, 'example.invalid', false, '{"in": 1}', '2023-04-01', '2023-04-01', array['hub'], null, null, null, false, 'internal');

-- 5. the staged messages (kept, with their one line; never a body)
insert into import_stage.mail_messages (run_id, mailbox, gmail_id, thread_id, msg_md5, sent_at, state, direction, box, writer, writer_name, recipients, subject, line, topic, lang, asks_to_stop, read_at) values
  (9201, 'steel', 'gm292A1', 'thN', md5('m1'), now() - interval '3 months', 'kept', 'in', 'steel', 'new.writer@neworg.example.org', 'Test New Writer', null, 'Partnership idea', 'Asks whether Welfare Avenue would partner on a food drive.', 'partnership', 'en', false, now()),
  (9201, 'steel', 'gm292A2', 'thN', md5('m2'), now() - interval '3 months' + interval '1 day', 'kept', 'out', 'steel', null, null, array['new.writer@neworg.example.org'], 'Partnership idea', 'Says yes and offers a call next week.', 'partnership', 'en', false, now()),
  (9201, 'hub', 'gm292H1', 'thE', md5('m3'), '2021-05-01 10:00+00', 'kept', 'in', 'info', 'existing.writer@org.example.org', 'Test Existing Writer', null, 'Event question', 'Asks about the date of the next event.', 'event', 'fr', false, now()),
  (9201, 'hub', 'gm292H2', 'thG', md5('m4'), '2022-01-10 10:00+00', 'kept', 'in', 'hub', 'info@generalorg.example.org', 'Info', null, 'Hello', 'Introduces the organisation.', 'other', 'en', false, now()),
  (9201, 'hub', 'gm292H3', 'thS', md5('m5'), '2022-05-01 10:00+00', 'kept', 'in', 'hub', 'stop.writer@example.org', 'Test Stop Writer', null, 'Please stop', 'Asks to be removed from the list.', 'other', 'en', true, now()),
  (9201, 'hub', 'gm292H4', 'thL', md5('m6'), '2023-01-01 10:00+00', 'kept', 'in', 'hub', 'left.out@example.org', 'Test Left Out', null, 'Gift', 'Offers a gift.', 'donation', 'en', false, now()),
  (9201, 'steel', 'gm292A3', null, null, '2021-03-12 10:00+00', 'skipped', null, null, null, null, null, null, null, null, null, false, null);
update import_stage.mail_messages set reason = 'bounce', bounce_addr = 'gone.person@example.org', bounce_code = '5.1.1' where gmail_id = 'gm292A3';
insert into import_stage.mail_seen (msg_md5, mailbox, gmail_id, run_id) values (md5('m1'), 'steel', 'gm292A1', 9201);

-- 6. the staged organisations
insert into import_stage.mail_orgs (run_id, domain, partner_id, robots, fetched_at, url, facts, conf, outcome) values
  (9201, 'neworg.example.org', null, 'allowed', now(), 'https://neworg.example.org/', '{"name": "Test New Org", "kind": "nonprofit", "description": "Runs a test pantry.", "city": "Montreal", "province": "QC"}', 0.8, 'found'),
  (9201, 'org.example.org', null, 'allowed', now(), 'https://www.org.example.org/', '{"name": "Test Partner Org", "description": "A test partner organisation."}', 0.7, 'found'),
  (9201, 'robots.example.org', null, 'refused', null, null, null, null, 'robots');
