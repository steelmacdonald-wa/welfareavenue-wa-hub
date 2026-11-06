-- Welfare Avenue Hub: wave281. Assertions for build/data/wa281_rules.sql (Phase 1 of the Hub CRM slice 1: the CRM rules in the database).
-- Assumes test/w281schema.sql and the migration are loaded. Everything runs in one transaction and ends with a rollback; any failed assertion raises.
-- Offline: node test/w281sql.mjs (PGlite). Every row is invented (Test ..., example.invalid, 555 numbers).
-- Note for readers: wa.consent_source is set local to the transaction by crm_set_do_not_contact, wa171_inbound and the others, so this script (one long
-- transaction) clears it after each such call. In the Hub each call is its own transaction.

begin;

-- ---------------------------------------------------------------- chapters
do $$
begin
  assert (select string_agg(code || '/' || name_fr || '/' || mail_route || '/' || ops_team || '/' || sort, ',' order by sort) from public.crm_chapters)
    = 'montreal/Montréal/volunteer/opsmtl/1,toronto/Toronto/toronto/opsto/2', 'the two chapters, as the brief gives them';
  -- the backfill
  assert (select count(*) from public.crm_contact_chapters where chapter = 'toronto') = 44, 'the 44 Toronto-tagged contacts get toronto';
  assert (select count(*) from public.crm_contact_chapters where chapter = 'toronto' and contact_id between 1001 and 1044) = 44, 'exactly the tagged ones (tags[] and Keela tags)';
  assert (select count(*) from public.crm_contact_chapters where chapter = 'toronto' and contact_id between 1041 and 1044 and source_ref = 'keela tag') = 4, 'four from Keela''s tags';
  assert not exists (select 1 from public.crm_contact_chapters where contact_id in (1045, 1046, 1047)), 'not a merged contact, not Keela tags that are not a list, not a Montreal tag';
  assert (select string_agg(contact_id || ':' || source_ref, ',' order by contact_id) from public.crm_contact_chapters where chapter = 'montreal')
    = '1001:old website serving,1101:serving,1102:old website serving,1103:form,1104:application,1105:application',
    'montreal from a confirmed completed serving, an attended old-website serving, a processed Montreal form, an application (by contact or by person); not a planned serving, a spam answer or an unattended row';
  assert (select bool_and(source = 'evidence' and added_by = 'wave281') from public.crm_contact_chapters), 'the backfill rows say evidence, wave281';
  -- crm_in_chapter
  assert public.crm_in_chapter(1047, 'montreal') = true, 'no chapter row: in Montreal';
  assert public.crm_in_chapter(1047, 'toronto') = false, 'no chapter row: not in Toronto';
  assert public.crm_in_chapter(1002, 'toronto') = true, 'a toronto row: in Toronto';
  assert public.crm_in_chapter(1002, 'montreal') = false, 'only a toronto row: not in Montreal';
  assert public.crm_in_chapter(1001, 'montreal') and public.crm_in_chapter(1001, 'toronto'), 'both rows: in both';
  assert public.crm_in_chapter(1047, 'all') and public.crm_in_chapter(1002, 'All'), 'all is everyone';
  assert public.crm_in_chapter(1047, 'ottawa') = false and public.crm_in_chapter(1047, null) = false, 'an unknown code or no code: not in it';
  -- crm_add_chapter
  assert public.crm_add_chapter(1047, 'toronto', 'hand', 'test') = true, 'crm_add_chapter adds a row';
  assert public.crm_add_chapter(1047, 'toronto', 'form', 'test again') = false, 'and does nothing the second time';
  assert (select source || '/' || source_ref || '/' || added_by from public.crm_contact_chapters where contact_id = 1047) = 'hand/test/system', 'the first row stays as it was';
  assert public.crm_in_chapter(1047, 'toronto') and not public.crm_in_chapter(1047, 'montreal'), 'after the row, Toronto and not Montreal';
end $$;

-- crm_in_chapter is security invoker: someone who cannot read crm_contact_chapters sees nobody's rows
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.nocrm@example.invalid","sub":"00000000-0000-0000-0000-000000000009"}', true);
set local role authenticated;
do $$
begin
  assert public.crm_in_chapter(1002, 'toronto') = false, 'a member without the CRM page reads no chapter rows (row security applies)';
  assert (select count(*) from public.crm_contact_chapters) = 0, 'and reads nothing from the table';
end $$;
reset role;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.member@example.invalid","sub":"00000000-0000-0000-0000-000000000001"}', true);
set local role authenticated;
do $$
declare v_ok boolean := false;
begin
  assert public.crm_in_chapter(1002, 'toronto') = true, 'a CRM member reads them';
  insert into public.crm_contact_chapters (contact_id, chapter, source, added_by) values (1047, 'montreal', 'hand', 'w281.member@example.invalid');
  delete from public.crm_contact_chapters where contact_id = 1047 and chapter = 'montreal';
  begin perform public.crm_add_chapter(1047, 'montreal', 'hand', null); exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'a signed-in member cannot run crm_add_chapter (service role only); the page writes the table under its policies';
end $$;
reset role;

-- ---------------------------------------------------------------- the consent log
do $$
declare r record; v_ok boolean;
begin
  perform set_config('request.jwt.claims', '', true);
  insert into public.crm_contacts (id, full_name) overriding system value values (1601, 'Test Plain New');
  assert (select count(*) from public.crm_consent_events where contact_id = 1601) = 0, 'a plain new contact writes nothing';
  insert into public.crm_contacts (id, full_name, email_status, sms_opt_out, email_consent) overriding system value values (1602, 'Test New Subscribed', 'subscribed', true, 'express');
  assert (select string_agg(column_name || '=' || new_value || '/' || channel || '/' || source || '/' || actor || '/' || coalesce(old_value, '-'), ',' order by column_name)
            from public.crm_consent_events where contact_id = 1602)
    = 'email_consent=express/email/system/system/-,email_status=subscribed/email/system/system/-,sms_opt_out=true/sms/system/system/-',
    'a new contact with values off the defaults writes one row for each of them';

  -- staff
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"W281.Member@example.invalid","sub":"00000000-0000-0000-0000-000000000001"}', true);
  update public.crm_contacts set email_status = 'subscribed' where id = 1601;
  assert (select count(*) from public.crm_consent_events where contact_id = 1601) = 1, 'changing email_status writes one row';
  select * into r from public.crm_consent_events where contact_id = 1601;
  assert r.channel = 'email' and r.column_name = 'email_status' and r.old_value = 'unknown' and r.new_value = 'subscribed' and r.source = 'staff'
     and r.actor = 'w281.member@example.invalid' and r.words is null and r.import_batch_id is null, 'channel email, the old and new values, source staff, the actor in lower case';
  update public.crm_contacts set implied_consent_until = current_date + 30 where id = 1601;
  assert (select count(*) from public.crm_consent_events where contact_id = 1601) = 1, 'changing only implied_consent_until writes none';
  update public.crm_contacts set email_status = 'subscribed', notes = 'same status' where id = 1601;
  assert (select count(*) from public.crm_consent_events where contact_id = 1601) = 1, 'setting the same value writes none';
  update public.crm_contacts set email_consent = 'express', consent_source = 'phone call 06/11' where id = 1601;
  assert (select source from public.crm_consent_events where contact_id = 1601 and column_name = 'email_consent') = 'phone call 06/11', 'a consent_source changed in the same update is the source';
  perform set_config('wa.consent_source', 'form: test-plain-form', true);
  perform set_config('wa.consent_words', 'Yes, text me', true);
  update public.crm_contacts set sms_consent = 'express' where id = 1601;
  select * into r from public.crm_consent_events where contact_id = 1601 and column_name = 'sms_consent';
  assert r.channel = 'sms' and r.source = 'form: test-plain-form' and r.words = 'Yes, text me' and r.new_value = 'express', 'wa.consent_source and wa.consent_words win';
  perform set_config('wa.consent_source', '', true);
  perform set_config('wa.consent_words', '', true);
  update public.crm_contacts set whatsapp_opt_out = true where id = 1601;
  assert (select channel || '/' || source from public.crm_consent_events where contact_id = 1601 and column_name = 'whatsapp_opt_out') = 'whatsapp/staff', 'whatsapp_opt_out is the whatsapp channel';

  -- a website account (signed in, not staff), the system, an import batch
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.donor@example.invalid","sub":"00000000-0000-0000-0000-000000000002"}', true);
  update public.crm_contacts set email_status = 'unsubscribed' where id = 1602;
  assert (select source || '/' || actor from public.crm_consent_events where contact_id = 1602 and column_name = 'email_status' and new_value = 'unsubscribed')
    = 'website account/w281.donor@example.invalid', 'a website account''s own change is website account, not staff';
  perform set_config('request.jwt.claims', '', true);
  update public.crm_contacts set sms_opt_out = false where id = 1602;
  assert (select source || '/' || actor from public.crm_consent_events where contact_id = 1602 and column_name = 'sms_opt_out' and new_value = 'false') = 'system/system', 'nobody signed in: system';
  perform set_config('wa.import_batch', '6', true);
  update public.crm_contacts set email_consent = 'none' where id = 1602;
  assert (select import_batch_id from public.crm_consent_events where contact_id = 1602 and column_name = 'email_consent' and new_value = 'none') = 6, 'wa.import_batch is recorded';
  perform set_config('wa.import_batch', '', true);

  -- append-only
  v_ok := false;
  begin update public.crm_consent_events set source = 'x' where contact_id = 1601; exception when others then v_ok := sqlerrm like '%append-only%'; end;
  assert v_ok, 'an update of the log is refused';
  v_ok := false;
  begin delete from public.crm_consent_events where contact_id = 1601; exception when others then v_ok := sqlerrm like '%append-only%'; end;
  assert v_ok, 'a delete from the log is refused';
  perform set_config('wa.consent_merge', 'on', true);
  update public.crm_consent_events set words = words where contact_id = 1601;
  v_ok := false;
  begin truncate public.crm_consent_events; exception when others then v_ok := sqlerrm like '%append-only: truncate is refused%'; end;
  assert v_ok, 'a truncate of the log is refused, even with the merge setting on and as the table owner';
  perform set_config('wa.consent_merge', '', true);
  v_ok := false;
  begin truncate public.crm_contacts cascade; exception when others then v_ok := sqlerrm like '%append-only: truncate is refused%'; end;
  assert v_ok, 'and so is a truncate that cascades to it from crm_contacts';
  assert (select count(*) from public.crm_consent_events where contact_id = 1601) = 4, 'the four log rows are all still there';
  delete from public.crm_contacts where id = 1602;
  assert (select count(*) from public.crm_consent_events where contact_id = 1602) = 0, 'deleting a contact takes its log with it (the cascade passes the guard)';
end $$;

-- ---------------------------------------------------------------- the backfills (the migration loaded them; test/w281sql.mjs proves a second run adds none)
do $$
begin
  assert (select string_agg(contact_id || ':' || new_value || ':' || source || ':' || to_char(occurred_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS'), ',' order by contact_id)
            from public.crm_consent_events where column_name = 'form consent')
    = '1103:given:form: test-montreal-form:2026-10-02 18:58:54,1108:not given:form: test-plain-form:2026-10-03 12:00:00,1112:given:form: test-plain-form:2026-10-08 12:00:01',
    'one row per processed, non-test answer with a contact and consent; at, or created_at when there is no at';
  assert (select bool_and(channel = 'email' and words = 'Yes, email me' and actor = 'wave281 backfill' and old_value is null) from public.crm_consent_events where column_name = 'form consent'),
    'channel email, the words from asked';
  assert (select string_agg(contact_id || ':' || column_name || ':' || old_value || '>' || new_value || ':' || channel || ':' || actor || ':' || to_char(occurred_at at time zone 'UTC', 'MM-DD HH24'), ',' order by contact_id)
            from public.crm_consent_events where source = 'change_log')
    = '1108:email_status:unknown>unsubscribed:email:w281.member@example.invalid:10-05 10,1112:sms_opt_out:false>true:sms:w281.member@example.invalid:10-06 10',
    'the change_log rows on contacts that still exist, with their recorded values, author and time; not a missing contact, a non-number id or another field';
end $$;

-- ---------------------------------------------------------------- do-not-contact
do $$
declare r record; v_ok boolean; k text;
begin
  perform set_config('request.jwt.claims', '', true);
  insert into public.crm_contacts (id, full_name, emails, email_status) overriding system value values
    (1701, 'Test Deceased', array['w281.dnc@example.invalid'], 'subscribed'), (1702, 'Test Bounced', array['w281.bounced@example.invalid'], 'bounced');
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.nocrm@example.invalid","sub":"00000000-0000-0000-0000-000000000009"}', true);
  v_ok := false;
  begin perform public.crm_set_do_not_contact(1701, 'deceased'); exception when others then v_ok := sqlerrm = 'not allowed'; end;
  assert v_ok, 'a member without the CRM page cannot set do-not-contact';
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.donor@example.invalid","sub":"00000000-0000-0000-0000-000000000002"}', true);
  v_ok := false;
  begin perform public.crm_set_do_not_contact(1701, 'deceased'); exception when others then v_ok := sqlerrm = 'not allowed'; end;
  assert v_ok, 'nor a website account';
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.member@example.invalid","sub":"00000000-0000-0000-0000-000000000001"}', true);
  v_ok := false;
  begin perform public.crm_set_do_not_contact(1701, 'moved away'); exception when others then v_ok := sqlerrm like '%deceased, asked or other%'; end;
  assert v_ok, 'only the three reasons';
  v_ok := false;
  begin perform public.crm_set_do_not_contact(-1, 'asked'); exception when others then v_ok := sqlerrm like '%is not in the CRM%'; end;
  assert v_ok, 'an unknown contact is refused';

  perform public.crm_set_do_not_contact(1701, 'deceased');
  perform set_config('wa.consent_source', '', true);
  select * into r from public.crm_contacts where id = 1701;
  assert r.do_not_contact and r.dnc_reason = 'deceased' and r.dnc_at is not null and r.dnc_by = 'w281.member@example.invalid', 'the flag, reason, time and who';
  assert r.email_status = 'unsubscribed' and r.sms_opt_out and r.whatsapp_opt_out, 'the three opt-outs';
  assert r.consent_source = 'do not contact: deceased', 'consent_source says so';
  assert (select string_agg(column_name || '=' || new_value || '/' || source, ',' order by column_name) from public.crm_consent_events where contact_id = 1701 and source <> 'system')
    = 'email_status=unsubscribed/do not contact: deceased,sms_opt_out=true/do not contact: deceased,whatsapp_opt_out=true/do not contact: deceased', 'three log rows (besides the one from creating the contact as subscribed)';
  foreach k in array array['transactional', 'test', 'newsletter', 'fundraising', 'volunteer'] loop
    select * into r from public.crm_email_permission(1701, k);
    assert r.allowed = false and r.basis = 'do not contact', 'crm_email_permission refuses the ' || k || ' kind with do not contact';
  end loop;

  perform public.crm_set_do_not_contact(1701, null);
  perform set_config('wa.consent_source', '', true);
  select * into r from public.crm_contacts where id = 1701;
  assert not r.do_not_contact and r.dnc_reason is null and r.dnc_at is null and r.dnc_by is null, 'clearing clears the four fields';
  assert r.email_status = 'unsubscribed' and r.sms_opt_out and r.whatsapp_opt_out, 'and never resubscribes anyone';
  assert (select count(*) from public.crm_consent_events where contact_id = 1701) = 4, 'clearing writes no consent row';
  assert (select old_value || '>' || new_value || '/' || changed_by from public.change_log where entity_type = 'crm_contact' and entity_id = '1701' and field = 'do_not_contact')
    = 'deceased>do not contact cleared/w281.member@example.invalid', 'and one change_log line';
  select * into r from public.crm_email_permission(1701, 'transactional');
  assert r.allowed = true, 'once cleared, a transactional email may go again (the address stays unsubscribed for the rest)';

  perform public.crm_set_do_not_contact(1702, 'asked');
  perform set_config('wa.consent_source', '', true);
  assert (select email_status || '/' || do_not_contact from public.crm_contacts where id = 1702) = 'bounced/true', 'a bounced address keeps bounced';
  select * into r from public.crm_email_permission(1301, 'transactional');
  assert r.allowed = true and r.basis like 'transactional%', 'someone else is untouched';
end $$;

-- ---------------------------------------------------------------- STOP sticks to the phone number
do $$
declare v jsonb;
begin
  perform set_config('request.jwt.claims', '', true);
  assert (select string_agg(phone_digits || ':' || channel, ',' order by phone_digits, channel) from public.wa_stopped_phones_v) = '5145550101:sms,5145550105:whatsapp',
    'the stopped phones: a STOP held by nobody (sms) and a WhatsApp STOP; not a STOP followed by START, not a question';
  assert not exists (select 1 from public.crm_contacts c, unnest(c.phones) ph where public.wa171_digits(ph) = '5145550101'), 'no contact holds 5145550101';
  assert public.wa171_opted_out(null, '+1 (514) 555-0101') = true, 'wa171_opted_out is true for a phone whose latest keyword text was STOP and that no contact holds';
  assert public.wa171_opted_out(null, '514-555-0102') = false, 'START cleared it';
  assert public.wa171_opted_out(null, '5145550105') = false, 'a WhatsApp STOP does not stop texts';
  assert public.wa171_opted_out(null, '5145550104') = false and public.wa171_opted_out(null, null) = false, 'a question, or no phone: not stopped';

  -- STOP and START through wa171_inbound
  v := public.wa171_inbound('{"phone": "+15145550201", "text": "STOP", "quo_id": "w281-q1", "at": "2026-11-06T10:00:00Z"}');
  assert v ->> 'handled' = 'opted_out', 'STOP is handled';
  assert (select sms_opt_out from public.crm_contacts where id = 1101), 'the contact with that phone is opted out';
  assert (select source from public.crm_consent_events where contact_id = 1101 and column_name = 'sms_opt_out' and new_value = 'true') = 'STOP text', 'the log says STOP text';
  assert exists (select 1 from public.wa_stopped_phones_v where phone_digits = '5145550201' and channel = 'sms'), 'the phone is in the stopped list';
  perform set_config('wa.consent_source', '', true);
  update public.app_config set value = 'live' where key = 'sms_mode';
  v := public.wa171_inbound('{"phone": "+15145550201", "text": "START", "quo_id": "w281-q2", "at": "2026-11-06T11:00:00Z"}');
  assert v ->> 'handled' = 'opted_in', 'START is handled (sms_mode live)';
  assert (select source from public.crm_consent_events where contact_id = 1101 and column_name = 'sms_opt_out' and new_value = 'false') = 'START text', 'the log says START text';
  assert not exists (select 1 from public.wa_stopped_phones_v where phone_digits = '5145550201' and channel = 'sms'), 'START takes the phone off the list';
  assert public.wa171_opted_out(501, '5145550201') = false, 'and the volunteer can be texted again';
  perform set_config('wa.consent_source', '', true);

  -- a WhatsApp STOP through wa254_inbound
  v := public.wa254_inbound('{"phone": "+15145550201", "text": "STOP", "wamid": "w281-w1", "at": "2026-11-06T12:00:00Z"}');
  assert v ->> 'handled' = 'opted_out', 'a WhatsApp STOP is handled';
  assert (select channel || '/' || source from public.crm_consent_events where contact_id = 1101 and column_name = 'whatsapp_opt_out') = 'whatsapp/WhatsApp STOP', 'the log says WhatsApp STOP';
  assert exists (select 1 from public.wa_stopped_phones_v where phone_digits = '5145550201' and channel = 'whatsapp'), 'the phone is on the WhatsApp stopped list';
  perform set_config('wa.consent_source', '', true);

  -- the implied-consent refresh
  perform public.crm_refresh_implied_consent();
  assert (select source from public.crm_consent_events where contact_id = 1301 and column_name = 'email_consent' and new_value = 'implied') = 'daily implied-consent refresh',
    'the refresh is recorded as daily implied-consent refresh';
  perform set_config('wa.consent_source', '', true);
end $$;

-- ---------------------------------------------------------------- do-not-contact holds the opt-outs on its own (final review I1, trg_wa281_dnc_hold)
do $$
declare r record;
begin
  perform set_config('request.jwt.claims', '', true);
  -- an insert with do-not-contact already on: the three opt-outs, each logged once; a bounce stays a bounce
  insert into public.crm_contacts (id, full_name, emails, phones, email_status, do_not_contact, dnc_reason) overriding system value values
    (1711, 'Test Dnc Insert', array['w281.dnc.insert@example.invalid'], array['+1 514 555 0711'], 'subscribed', true, 'asked'),
    (1712, 'Test Dnc Bounced', array['w281.dnc.bounced@example.invalid'], '{}', 'bounced', true, 'other'),
    (1713, 'Test Dnc Complained', array['w281.dnc.complained@example.invalid'], '{}', 'complained', true, 'asked');
  select * into r from public.crm_contacts where id = 1711;
  assert r.sms_opt_out and r.whatsapp_opt_out and r.email_status = 'unsubscribed', 'an insert with do-not-contact on gets texts, WhatsApp and email off';
  assert (select string_agg(column_name || '=' || new_value, ',' order by column_name) from public.crm_consent_events where contact_id = 1711)
    = 'email_status=unsubscribed,sms_opt_out=true,whatsapp_opt_out=true', 'and the log records each once';
  assert (select string_agg(id || ':' || email_status, ',' order by id) from public.crm_contacts where id in (1712, 1713)) = '1712:bounced,1713:complained',
    'an insert keeps bounced and complained';
end $$;

-- a staff member's update (the page's Email permission form) cannot turn them back on, and writes no false change rows
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.member@example.invalid","sub":"00000000-0000-0000-0000-000000000001"}', true);
set local role authenticated;
do $$
declare r record; n int := (select count(*) from public.crm_consent_events where contact_id in (1711, 1712, 1713));
begin
  update public.crm_contacts set sms_opt_out = false, whatsapp_opt_out = false, email_status = 'unknown' where id = 1711;
  select * into r from public.crm_contacts where id = 1711;
  assert r.sms_opt_out and r.whatsapp_opt_out and r.email_status = 'unsubscribed', 'a staff update setting the opt-outs off on a do-not-contact contact leaves them on';
  update public.crm_contacts set email_status = 'unknown' where id = 1712;
  update public.crm_contacts set email_status = 'unsubscribed' where id = 1713;
  assert (select string_agg(id || ':' || email_status, ',' order by id) from public.crm_contacts where id in (1712, 1713)) = '1712:bounced,1713:complained',
    'bounced and complained are not overwritten';
  assert (select count(*) from public.crm_consent_events where contact_id in (1711, 1712, 1713)) = n, 'and no consent row is written for a value that did not change';
end $$;
reset role;

do $$
declare r record; v jsonb; n int;
begin
  perform set_config('request.jwt.claims', '', true);
  -- a START from the contact's own phone (sms_mode is live since the block above): handled, the phone leaves the stopped list, the contact stays stopped
  n := (select count(*) from public.crm_consent_events where contact_id = 1711);
  v := public.wa171_inbound('{"phone": "+15145550711", "text": "START", "quo_id": "w281-q11", "at": "2026-11-06T13:00:00Z"}');
  perform set_config('wa.consent_source', '', true);
  assert v ->> 'handled' = 'opted_in', 'START from a do-not-contact contact''s phone is handled';
  assert (select sms_opt_out from public.crm_contacts where id = 1711), 'and their texts stay stopped';
  assert (select count(*) from public.crm_consent_events where contact_id = 1711) = n, 'with no START text row in their log';
  assert public.wa171_opted_out(null, '5145550711') = true, 'wa171_opted_out still says stopped';

  -- a merge that brings in a do-not-contact contact; the dropped record's opt-outs predate this rule (texts and email back on, set with triggers off)
  insert into public.crm_contacts (id, full_name, emails, email_status) overriding system value values (1714, 'Test Dnc Keep', array['w281.dnc.keep@example.invalid'], 'subscribed');
  perform set_config('session_replication_role', 'replica', true);
  insert into public.crm_contacts (id, full_name, emails, email_status, do_not_contact, dnc_reason, dnc_at, dnc_by) overriding system value
    values (1715, 'Test Dnc Drop', array['w281.dnc.drop@example.invalid'], 'subscribed', true, 'asked', now(), 'w281.member@example.invalid');
  perform set_config('session_replication_role', 'origin', true);
  assert (select not sms_opt_out and email_status = 'subscribed' from public.crm_contacts where id = 1715), 'the dropped record starts with texts and email on';
  n := (select max(id) from public.crm_consent_events);
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.member@example.invalid","sub":"00000000-0000-0000-0000-000000000001"}', true);
  perform public.crm_merge_contacts(1714, 1715);
  perform set_config('request.jwt.claims', '', true);
  select * into r from public.crm_contacts where id = 1714;
  assert r.do_not_contact and r.sms_opt_out and r.whatsapp_opt_out and r.email_status = 'unsubscribed', 'the kept contact takes do-not-contact, and with it texts, WhatsApp and email off';
  assert (select string_agg(column_name || '=' || new_value, ',' order by column_name) from public.crm_consent_events where contact_id = 1714 and id > n)
    = 'email_status=unsubscribed,sms_opt_out=true,whatsapp_opt_out=true', 'and the log records the three changes on the kept contact';

  -- writing do_not_contact alone (as the service role or a direct API write could): the opt-outs follow, and the log records them
  insert into public.crm_contacts (id, full_name, emails) overriding system value values (1716, 'Test Dnc Direct', array['w281.dnc.direct@example.invalid']);
  update public.crm_contacts set do_not_contact = true, dnc_reason = 'other' where id = 1716;
  select * into r from public.crm_contacts where id = 1716;
  assert r.sms_opt_out and r.whatsapp_opt_out and r.email_status = 'unsubscribed', 'setting do_not_contact alone turns the three off';
  assert (select count(*) from public.crm_consent_events where contact_id = 1716 and column_name in ('email_status', 'sms_opt_out', 'whatsapp_opt_out')) = 3, 'and the log has a row for each';

  -- clearing do-not-contact leaves the opt-outs as they were; after that, the usual rules apply again
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.member@example.invalid","sub":"00000000-0000-0000-0000-000000000001"}', true);
  perform public.crm_set_do_not_contact(1711, null);
  perform set_config('wa.consent_source', '', true);
  select * into r from public.crm_contacts where id = 1711;
  assert not r.do_not_contact and r.sms_opt_out and r.whatsapp_opt_out and r.email_status = 'unsubscribed', 'clearing do-not-contact leaves the opt-outs as they were';
  update public.crm_contacts set sms_opt_out = false where id = 1711;
  assert not (select sms_opt_out from public.crm_contacts where id = 1711), 'once it is cleared, staff can turn texts back on';
  perform set_config('request.jwt.claims', '', true);
end $$;

-- ---------------------------------------------------------------- access
do $$
declare v_caps jsonb;
begin
  update public.hub_roles set caps = '{"gifts_edit": true}' where email in ('w281.finance@example.invalid', 'w281.blocked@example.invalid');
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.leader@example.invalid"}', true);
  assert public.wa_can('gifts_edit') and not public.wa_can('import_admin') and not public.wa_can('hr_private'), 'a leader: gifts_edit only';
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.member@example.invalid"}', true);
  assert not public.wa_can('gifts_edit') and not public.wa_can('import_admin') and not public.wa_can('hr_private'), 'a member: none';
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.finance@example.invalid"}', true);
  assert public.wa_can('gifts_edit'), 'a member with caps {"gifts_edit": true}: gifts_edit';
  v_caps := public.wa_my_caps();
  assert v_caps = '{"gifts_edit": true, "hr_private": false, "import_admin": false}'::jsonb, 'wa_my_caps gives the three';
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.hr@example.invalid"}', true);
  assert public.wa_can('hr_private') and public.wa_is_hr() and not public.wa_can('gifts_edit'), 'hr_private follows wa_is_hr';
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.admin@example.invalid"}', true);
  assert public.wa_can('gifts_edit') and public.wa_can('import_admin') and public.wa_can('hr_private'), 'an admin: all three';
  assert not public.wa_can('delete_everything') and not public.wa_can(null), 'an unknown capability is false, even for an admin';
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.blocked@example.invalid"}', true);
  assert not public.wa_can('gifts_edit'), 'blocked: false, caps or not';
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.donor@example.invalid"}', true);
  assert not public.wa_can('gifts_edit') and public.wa_my_caps() = '{"gifts_edit": false, "hr_private": false, "import_admin": false}'::jsonb, 'no hub_roles row: false';
  perform set_config('request.jwt.claims', '', true);
  assert not public.wa_can('import_admin'), 'nobody signed in: false';
  update public.hub_roles set caps = '{}' where email in ('w281.finance@example.invalid', 'w281.blocked@example.invalid');
end $$;

-- a member's self-added row cannot carry a capability
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.newstaff@welfareavenue.com","sub":"00000000-0000-0000-0000-000000000003"}', true);
set local role authenticated;
do $$
declare v_ok boolean := false;
begin
  begin insert into public.hub_roles (email, role, caps) values ('w281.newstaff@welfareavenue.com', 'member', '{"gifts_edit": true}');
  exception when others then v_ok := sqlerrm like '%row-level security%'; end;
  assert v_ok, 'a self-insert into hub_roles with caps is refused';
  insert into public.hub_roles (email, role) values ('w281.newstaff@welfareavenue.com', 'member');
end $$;
reset role;
do $$ begin assert (select caps from public.hub_roles where email = 'w281.newstaff@welfareavenue.com') = '{}'::jsonb, 'the plain self-insert still works, with empty caps'; end $$;

-- only admins change the keela_ settings
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.leader@example.invalid"}', true);
set local role authenticated;
do $$
declare v_ok boolean := false;
begin
  begin update public.app_config set value = '45' where key = 'keela_notice_days'; exception when others then v_ok := sqlerrm like 'Only an admin can change keela_notice_days%'; end;
  assert v_ok, 'a leader cannot change a keela_ setting';
  v_ok := false;
  begin insert into public.app_config (key, value) values ('keela_field_map', '{}'); exception when others then v_ok := sqlerrm like 'Only an admin can change keela_field_map%'; end;
  assert v_ok, 'nor add one';
  insert into public.app_config (key, value) values ('w281_other_setting', 'x');
end $$;
reset role;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.admin@example.invalid"}', true);
set local role authenticated;
update public.app_config set value = '45' where key = 'keela_notice_days';
reset role;
do $$ begin assert (select value from public.app_config where key = 'keela_notice_days') = '45' and exists (select 1 from public.app_config where key = 'w281_other_setting'), 'an admin can; other settings stay open to staff'; end $$;

-- ---------------------------------------------------------------- private data
do $$
declare today date := (now() at time zone 'America/Toronto')::date;
begin
  perform set_config('request.jwt.claims', '', true);
  insert into public.crm_contacts (id, full_name) overriding system value
  select g, 'Test Age ' || g from generate_series(1401, 1406) g;
  insert into public.crm_contact_private (contact_id, birth_date, source) values
    (1401, (today - interval '15 years')::date, 'test'), (1402, (today - interval '16 years')::date, 'test'), (1403, (today - interval '17 years')::date, 'test'),
    (1404, (today - interval '18 years')::date, 'test'), (1405, null, 'test'), (1406, (today - interval '16 years' + interval '1 day')::date, 'test');
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.member@example.invalid"}', true);
  assert public.crm_age_band(1401) = 'under 16' and public.crm_age_band(1402) = '16 to 17' and public.crm_age_band(1403) = '16 to 17' and public.crm_age_band(1404) = '18 or older',
    'the age bands at 15, 16, 17 and 18 (today in Toronto)';
  assert public.crm_age_band(1406) = 'under 16', 'the day before the 16th birthday is still under 16';
  assert public.crm_age_band(1405) is null and public.crm_age_band(1047) is null, 'no date stored, or no row: null';
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.nocrm@example.invalid"}', true);
  assert public.crm_age_band(1404) is null, 'null for a member without the CRM page';
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.donor@example.invalid"}', true);
  assert public.crm_age_band(1404) is null, 'and for a website account';
end $$;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.member@example.invalid"}', true);
set local role authenticated;
do $$ begin assert (select count(*) from public.crm_contact_private) = 0, 'a member reads 0 rows from crm_contact_private'; end $$;
reset role;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.hr@example.invalid"}', true);
set local role authenticated;
do $$ begin assert (select count(*) from public.crm_contact_private) = 6, 'HR reads them'; end $$;
update public.crm_contact_private set source = 'HR check' where contact_id = 1405;
reset role;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.admin@example.invalid"}', true);
set local role authenticated;
do $$ begin assert (select count(*) from public.crm_contact_private where source = 'HR check') = 1, 'an admin reads them, and HR could write'; end $$;
reset role;

-- ---------------------------------------------------------------- merge
do $$
declare r record; v_drop_at timestamptz; c_ff bigint; c_rp bigint; v_moved bigint[];
begin
  select id into c_ff from public.wa_campaigns where name = 'Football Fundraiser 2026';
  select id into c_rp from public.wa_campaigns where name = 'Rally Paper 2026';
  perform set_config('request.jwt.claims', '', true);
  insert into public.crm_contacts (id, full_name, email_status) overriding system value values (1501, 'Test Keep', 'subscribed');
  insert into public.crm_contacts (id, full_name, job_title, sms_consent, sms_consent_source, sms_consent_at, whatsapp_opt_out) overriding system value
    values (1502, 'Test Drop', 'Chef', 'express', 'form: test-plain-form', '2026-10-01 12:00:00+00', true);
  insert into public.crm_contact_chapters (contact_id, chapter, source) values (1501, 'montreal', 'hand'), (1502, 'toronto', 'hand'), (1502, 'montreal', 'form');
  insert into public.wa_campaign_people (campaign_id, contact_id, part, source) values (c_ff, 1501, 'donor', 'hand'), (c_ff, 1502, 'donor', 'import'), (c_rp, 1502, 'volunteer', 'form');
  insert into public.crm_contact_private (contact_id, birth_date, source) values (1502, date '1990-01-01', 'Keela');
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.member@example.invalid","sub":"00000000-0000-0000-0000-000000000001"}', true);
  perform public.crm_set_do_not_contact(1502, 'asked');
  perform set_config('wa.consent_source', '', true);
  select dnc_at into v_drop_at from public.crm_contacts where id = 1502;
  select array_agg(id) into v_moved from public.crm_consent_events where contact_id = 1502;
  assert cardinality(v_moved) = 4, 'the dropped contact has four log rows (two at insert, two from do-not-contact)';

  perform public.crm_merge_contacts(1501, 1502);
  assert (select string_agg(chapter || ':' || source, ',' order by chapter) from public.crm_contact_chapters where contact_id = 1501) = 'montreal:hand,toronto:hand', 'chapters move (the kept row wins)';
  assert not exists (select 1 from public.crm_contact_chapters where contact_id = 1502), 'none left on the dropped contact';
  assert (select count(*) from public.crm_consent_events where contact_id = 1502) = 0 and (select bool_and(contact_id = 1501) from public.crm_consent_events where id = any(v_moved)),
    'the consent rows move to the kept contact';
  assert coalesce(current_setting('wa.consent_merge', true), '') <> 'on', 'and the merge setting is off again';
  assert (select string_agg(campaign_id || ':' || part || ':' || source, ',' order by part, campaign_id) from public.wa_campaign_people where contact_id = 1501)
    = c_ff || ':donor:hand,' || c_rp || ':volunteer:form', 'campaign rows move (the kept row wins)';
  assert not exists (select 1 from public.wa_campaign_people where contact_id = 1502), 'none left on the dropped contact';
  assert (select birth_date from public.crm_contact_private where contact_id = 1501) = date '1990-01-01' and not exists (select 1 from public.crm_contact_private where contact_id = 1502),
    'the private row moves when the kept contact has none';
  select * into r from public.crm_contacts where id = 1501;
  assert r.do_not_contact and r.dnc_reason = 'asked' and r.dnc_by = 'w281.member@example.invalid' and r.dnc_at = v_drop_at, 'do-not-contact comes from the dropped record, with its reason, time and author';
  assert r.sms_consent = 'express' and r.sms_consent_source = 'form: test-plain-form' and r.sms_consent_at = '2026-10-01 12:00:00+00' and r.job_title = 'Chef' and r.whatsapp_opt_out,
    'text consent with its source and date, the job title and the WhatsApp opt-out carry over';
  assert (select merged_into from public.crm_contacts where id = 1502) = 1501, 'the merge itself still happens';

  -- the kept record first: both do-not-contact, both with private rows
  perform set_config('request.jwt.claims', '', true);
  insert into public.crm_contacts (id, full_name, job_title) overriding system value values (1503, 'Test Keep Two', 'Teacher'), (1504, 'Test Drop Two', 'Chef');
  insert into public.crm_contact_private (contact_id, birth_date, source) values (1503, date '1980-05-05', 'Keela'), (1504, date '1999-09-09', 'Keela');
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.member@example.invalid","sub":"00000000-0000-0000-0000-000000000001"}', true);
  perform public.crm_set_do_not_contact(1503, 'deceased');
  perform public.crm_set_do_not_contact(1504, 'other');
  perform set_config('wa.consent_source', '', true);
  perform public.crm_merge_contacts(1503, 1504);
  select * into r from public.crm_contacts where id = 1503;
  assert r.dnc_reason = 'deceased' and r.job_title = 'Teacher', 'the kept record''s do-not-contact and job title stay';
  assert (select birth_date from public.crm_contact_private where contact_id = 1503) = date '1980-05-05' and not exists (select 1 from public.crm_contact_private where contact_id = 1504),
    'when both have a private row, the kept one stays and the dropped one is deleted';
end $$;

-- ---------------------------------------------------------------- Campaigns
do $$
declare c_gbd bigint; c_ff bigint; c_rp bigint; g bigint;
begin
  perform set_config('request.jwt.claims', '', true);
  assert (select count(*) from public.wa_campaigns) = 7, 'the seven seed rows';
  assert (select string_agg(name || '/' || type || '/' || year || '/' || coalesce(goal_amount::text, '-') || '/' || coalesce(keela_name, '-') || '/' || coalesce(donate_key, '-') || '/' || status || '/' || created_by, ',' order by id) from public.wa_campaigns)
    = 'Rally Paper 2026/fundraising_event/2026/-/Rally Paper 2026/-/active/wave281,Football Fundraiser 2025/fundraising_event/2025/-/Football Fundraiser 2025/-/done/wave281,'
      'Football Fundraiser 2026/fundraising_event/2026/-/Football Fundraiser 2026/-/active/wave281,Program Development/appeal/2026/5000/Program Development/-/active/wave281,'
      'Collaborative Sunday Servings/program/2026/-/Collaborative Sunday Servings/-/active/wave281,Holiday Gift Baskets/drive/2025/1000/Holiday Gift Baskets/-/done/wave281,'
      'Gift Basket Drive 2026/drive/2026/-/-/gift-basket-drive/active/wave281', 'the seed as the brief gives it';
  select id into c_gbd from public.wa_campaigns where donate_key = 'gift-basket-drive';
  select id into c_ff from public.wa_campaigns where name = 'Football Fundraiser 2026';
  select id into c_rp from public.wa_campaigns where name = 'Rally Paper 2026';
  assert public.crm_gift_campaign_id('Holiday Gift Basket Drive 2026') = c_gbd, 'Holiday Gift Basket Drive 2026 maps to Gift Basket Drive 2026';
  assert public.crm_gift_campaign_id('FOOTBALL fundraiser 2026') = c_ff, 'a name, ignoring case';
  assert public.crm_gift_campaign_id('fundraising campaign') is null and public.crm_gift_campaign_id('Something else') is null and public.crm_gift_campaign_id(null) is null,
    'fundraising campaign and anything else give null';
  -- the backfill
  assert (select string_agg(coalesce(campaign, '-') || '=' || coalesce((select name from public.wa_campaigns w where w.id = d.campaign_id), '-'), ',' order by d.id) from public.crm_donations d where d.contact_id = 1201)
    = 'Football Fundraiser 2026=Football Fundraiser 2026,Football Fundraiser 2026=Football Fundraiser 2026,football fundraiser 2025=Football Fundraiser 2025,'
      'Holiday Gift Baskets=Holiday Gift Baskets,Holiday Gift Basket Drive 2026=Gift Basket Drive 2026,fundraising campaign=-,-=-', 'every gift linked once by its text';
  -- the trigger
  insert into public.crm_donations (contact_id, amount, donated_at, campaign) values (1201, 5, now(), 'Holiday Gift Basket Drive 2026') returning id into g;
  assert (select campaign_id from public.crm_donations where id = g) = c_gbd, 'a new gift with that campaign text gets the link';
  update public.crm_donations set campaign = 'Football Fundraiser 2026' where id = g;
  assert (select campaign_id from public.crm_donations where id = g) = c_ff, 'a changed text moves the link';
  update public.crm_donations set campaign = 'A sponsor table', campaign_id = c_rp where id = g;
  assert (select campaign_id from public.crm_donations where id = g) = c_rp, 'a campaign_id set in the same statement is kept';
  update public.crm_donations set campaign = 'fundraising campaign' where id = g;
  assert (select campaign_id from public.crm_donations where id = g) is null, 'a text that names no campaign unlinks it';
  insert into public.crm_donations (contact_id, amount, donated_at, campaign, campaign_id) values (1201, 5, now(), 'Holiday Gift Basket Drive 2026', c_rp) returning id into g;
  assert (select campaign_id from public.crm_donations where id = g) = c_rp, 'a new gift that names its campaign_id keeps it';
  -- the drive forms
  assert (select string_agg(slug || '=' || coalesce(settings ->> 'campaign_id', '-'), ',' order by id) from public.crm_forms)
    = 'test-montreal-form=-,test-plain-form=-,test-gbd-give=' || c_gbd || ',test-gbd-volunteer=' || c_gbd, 'the gift-basket-drive forms carry campaign_id';
end $$;

-- ---------------------------------------------------------------- fields, organisations, the contacts view
do $$
begin
  assert (select string_agg(key || '/' || label || '/' || type || '/' || sort || '/' || options::text, ',' order by sort) from public.crm_fields where created_by = 'wave281')
    = 'linkedin/LinkedIn/text/190/[],car_make_model/Car (make and model)/text/200/[],car_seats/Car seats/number/210/[],food_licence/Food licence (MAPAQ)/choice/220/["MAPAQ permit acquired", "Interested", "Not interested"]',
    'the four fields, after the last existing row';
  assert (select array_agg(attname::text order by attnum desc) from (select attname, attnum from pg_attribute where attrelid = 'public.crm_contacts_v'::regclass and attnum > 0 order by attnum desc limit 4) x)
    = array['dnc_reason', 'do_not_contact', 'job_title', 'org_names'], 'crm_contacts_v ends with job_title, do_not_contact, dnc_reason';
  assert (select reloptions::text from pg_class where oid = 'public.crm_contacts_v'::regclass) = '{security_invoker=true}', 'crm_contacts_v stays security_invoker (stored as true, as live has it)';
  assert has_table_privilege('authenticated', 'public.crm_contacts_v', 'select') and not has_table_privilege('anon', 'public.crm_contacts_v', 'select'), 'and stays readable by signed-in users only';
  assert (select do_not_contact from public.crm_contacts_v where id = 1702) = true, 'the view shows do_not_contact';
  assert (select column_default from information_schema.columns where table_name = 'wa_partners' and column_name = 'goals') = '''{}''::text[]', 'wa_partners.goals defaults to empty';
end $$;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.member@example.invalid"}', true);
set local role authenticated;
do $$
declare v_ok boolean := false;
begin
  insert into public.wa_partners (name, visibility, created_by) values ('Test Org Everyone', 'everyone', 'w281.member@example.invalid');
  begin insert into public.wa_partners (name, visibility) values ('Test Org Leadership', 'leadership'); exception when others then v_ok := sqlerrm like '%row-level security%'; end;
  assert v_ok, 'CRM staff may add an organisation for everyone, not a leadership-only one';
end $$;
reset role;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.nocrm@example.invalid"}', true);
set local role authenticated;
do $$
declare v_ok boolean := false;
begin
  begin insert into public.wa_partners (name, visibility) values ('Test Org No CRM', 'everyone'); exception when others then v_ok := sqlerrm like '%row-level security%'; end;
  assert v_ok, 'a member without the CRM page may not';
end $$;
reset role;

-- ---------------------------------------------------------------- grants and row security
do $$
declare f text; t text;
begin
  foreach f in array array['public.crm_add_chapter(bigint,text,text,text)', 'public.crm_in_chapter(bigint,text)', 'public.crm_consent_log()', 'public.crm_consent_guard()',
                           'public.crm_set_do_not_contact(bigint,text)', 'public.crm_age_band(bigint)', 'public.wa_can(text)', 'public.wa_my_caps()',
                           'public.crm_gift_campaign_id(text)', 'public.wa281_gift_campaign()'] loop
    assert not has_function_privilege('anon', f, 'execute'), 'anon cannot run ' || f;
  end loop;
  foreach f in array array['public.crm_add_chapter(bigint,text,text,text)', 'public.crm_gift_campaign_id(text)', 'public.crm_consent_log()', 'public.crm_consent_guard()', 'public.wa281_gift_campaign()'] loop
    assert not has_function_privilege('authenticated', f, 'execute'), 'authenticated cannot run ' || f;
  end loop;
  foreach f in array array['public.crm_set_do_not_contact(bigint,text)', 'public.crm_age_band(bigint)', 'public.wa_can(text)', 'public.wa_my_caps()', 'public.crm_in_chapter(bigint,text)'] loop
    assert has_function_privilege('authenticated', f, 'execute') and has_function_privilege('service_role', f, 'execute'), 'authenticated and service_role run ' || f;
  end loop;
  assert has_function_privilege('service_role', 'public.crm_add_chapter(bigint,text,text,text)', 'execute') and has_function_privilege('service_role', 'public.crm_gift_campaign_id(text)', 'execute'),
    'the service role runs crm_add_chapter and crm_gift_campaign_id';
  assert not (select prosecdef from pg_proc where oid = 'public.crm_in_chapter(bigint,text)'::regprocedure), 'crm_in_chapter is security invoker';
  assert (select bool_and(prosecdef) from pg_proc where oid in ('public.crm_add_chapter(bigint,text,text,text)'::regprocedure, 'public.crm_set_do_not_contact(bigint,text)'::regprocedure,
          'public.crm_age_band(bigint)'::regprocedure, 'public.wa_can(text)'::regprocedure, 'public.crm_consent_log()'::regprocedure)), 'the others are security definer';
  assert not has_table_privilege('authenticated', 'public.wa_stopped_phones_v', 'select') and not has_table_privilege('anon', 'public.wa_stopped_phones_v', 'select')
     and has_table_privilege('service_role', 'public.wa_stopped_phones_v', 'select'), 'wa_stopped_phones_v is for the service role only';
  foreach t in array array['crm_chapters', 'crm_contact_chapters', 'crm_consent_events', 'crm_contact_private', 'wa_campaigns', 'wa_campaign_people'] loop
    assert (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass), t || ' has row level security';
    assert not has_table_privilege('anon', 'public.' || t, 'select') and not has_table_privilege('anon', 'public.' || t, 'insert')
       and not has_table_privilege('anon', 'public.' || t, 'update') and not has_table_privilege('anon', 'public.' || t, 'delete'), 'anon has nothing on ' || t;
  end loop;
  assert not has_table_privilege('authenticated', 'public.crm_consent_events', 'insert') and not has_table_privilege('authenticated', 'public.crm_consent_events', 'update')
     and not has_table_privilege('authenticated', 'public.crm_consent_events', 'delete') and not has_table_privilege('authenticated', 'public.crm_consent_events', 'truncate'),
    'signed-in users only read the consent log';
  assert not has_table_privilege('service_role', 'public.crm_consent_events', 'truncate') and not has_table_privilege('anon', 'public.crm_consent_events', 'truncate')
     and has_table_privilege('service_role', 'public.crm_consent_events', 'insert'), 'no API role holds truncate on the consent log; the service role can still write it';
  assert exists (select 1 from pg_trigger where tgname = 'trg_wa281_consent_no_truncate' and tgrelid = 'public.crm_consent_events'::regclass), 'the truncate trigger is there';
end $$;

select 'w281sql: all assertions passed' as result;
rollback;
