-- Welfare Avenue Hub: wave282. Assertions for build/data/wa282_mail_rule.sql (Phase 2 of the Hub CRM slice 1: the email rule).
-- Assumes test/w281schema.sql, build/data/wa281_rules.sql, test/w282schema.sql and the migration are loaded. Everything runs in one transaction and
-- ends with a rollback; any failed assertion raises. Offline: node test/w282sql.mjs (PGlite). Every row is invented (Test ..., example.invalid).

begin;

-- ---------------------------------------------------------------- who may be emailed (Part A.4)
do $$
declare p record; rule text := 'not unsubscribed (WA rule of 5 Nov 2026)';
begin
  -- a newsletter: unknown consent is allowed under the new rule; fundraising the same
  select * into p from public.crm_email_permission(2001, 'newsletter');
  assert p.allowed and p.basis = rule and p.email = 'w282.2001@example.invalid', 'newsletter, unknown consent: allowed, not unsubscribed (WA rule of 5 Nov 2026)';
  select * into p from public.crm_email_permission(2001, 'fundraising');
  assert p.allowed and p.basis = rule, 'fundraising, unknown consent: allowed with the same basis';
  select * into p from public.crm_email_permission(2017, 'newsletter');
  assert p.allowed and p.basis = rule and p.until is null, 'implied consent that ran out: allowed under the new rule';
  -- the volunteer branch is unchanged
  select * into p from public.crm_email_permission(2001, 'volunteer');
  assert p.allowed and p.basis = 'volunteer message: not unsubscribed (the team''s rule since 27/09/26)', 'volunteer: the branch and its basis are as before';
  -- express and implied keep their basis text
  select * into p from public.crm_email_permission(2006, 'newsletter');
  assert p.allowed and p.basis = 'express consent (form: test-plain-form)', 'express keeps its basis text';
  select * into p from public.crm_email_permission(2006, 'fundraising');
  assert p.allowed and p.basis = 'express consent (form: test-plain-form)', 'express keeps its basis text for fundraising';
  select * into p from public.crm_email_permission(2007, 'newsletter');
  assert p.allowed and p.basis like 'implied consent until % (gift on %)' and p.until >= current_date, 'implied consent keeps its basis text';
  select * into p from public.crm_email_permission(2007, 'fundraising');
  assert p.allowed and p.basis like 'implied consent until %', 'implied consent keeps its basis text for fundraising';
  -- refused
  select * into p from public.crm_email_permission(2002, 'newsletter');
  assert not p.allowed and p.basis = 'unsubscribed', 'unsubscribed: refused';
  select * into p from public.crm_email_permission(2002, 'fundraising');
  assert not p.allowed and p.basis = 'unsubscribed', 'unsubscribed: refused for fundraising';
  select * into p from public.crm_email_permission(2019, 'newsletter');
  assert not p.allowed and p.basis = 'unsubscribed', 'express but unsubscribed: refused';
  select * into p from public.crm_email_permission(2003, 'newsletter');
  assert not p.allowed and p.basis = 'bounced', 'bounced: refused';
  select * into p from public.crm_email_permission(2004, 'newsletter');
  assert not p.allowed and p.basis = 'complained', 'complained: refused';
  select * into p from public.crm_email_permission(2005, 'newsletter');
  assert not p.allowed and p.basis = 'do not contact', 'do-not-contact: refused';
  select * into p from public.crm_email_permission(2005, 'fundraising');
  assert not p.allowed and p.basis = 'do not contact', 'do-not-contact: refused for fundraising';
  select * into p from public.crm_email_permission(2016, 'newsletter');
  assert not p.allowed and p.basis = 'no email address', 'no address: refused';
  select * into p from public.crm_email_permission(2018, 'newsletter');
  assert not p.allowed and p.basis = 'merged into another contact', 'a merged contact: refused';
  select * into p from public.crm_email_permission(99999, 'newsletter');
  assert not p.allowed and p.basis = 'no such contact', 'no such contact: refused';
  -- transactional: unsubscribed still gets it, do-not-contact does not
  select * into p from public.crm_email_permission(2002, 'transactional');
  assert p.allowed and p.basis like 'transactional:%', 'transactional: allowed for an unsubscribed person';
  select * into p from public.crm_email_permission(2005, 'transactional');
  assert not p.allowed and p.basis = 'do not contact', 'transactional: refused for do-not-contact';
  select * into p from public.crm_email_permission(2003, 'transactional');
  assert not p.allowed and p.basis = 'bounced', 'transactional: refused for a bounced address';
  -- only newsletter and fundraising changed: any other kind still falls through to the old answer
  select * into p from public.crm_email_permission(2001, 'other');
  assert not p.allowed and p.basis = 'no consent recorded', 'an unknown kind is still refused';
  -- the exemption setting is gone, and putting it back on changes nothing
  assert not exists (select 1 from public.app_config where key = 'mail_fundraising_exemption'), 'mail_fundraising_exemption is deleted';
  insert into public.app_config (key, value) values ('mail_fundraising_exemption', 'on');
  select * into p from public.crm_email_permission(2001, 'fundraising');
  assert p.allowed and p.basis = rule, 'the function no longer reads the exemption setting';
  delete from public.app_config where key = 'mail_fundraising_exemption';
end $$;

-- ---------------------------------------------------------------- a Send is never transactional
do $$
declare v_err text;
begin
  begin
    insert into public.crm_campaigns (name, kind) values ('Test transactional Send', 'transactional');
    v_err := 'no error';
  exception when check_violation then v_err := 'check';
  end;
  assert v_err = 'check', 'a crm_campaigns row with kind transactional fails the kind check (' || v_err || ')';
  begin
    insert into public.crm_campaigns (name, kind) values ('Test test Send', 'test');
    v_err := 'no error';
  exception when check_violation then v_err := 'check';
  end;
  assert v_err = 'check', 'kind test fails too';
  insert into public.crm_campaigns (name, kind) values ('Test newsletter Send', 'newsletter'), ('Test fundraising Send', 'fundraising'), ('Test volunteer Send', 'volunteer');
  assert (select count(*) from public.crm_campaigns where name like 'Test % Send') = 3, 'newsletter, fundraising and volunteer Sends are accepted';
  assert (select pg_get_constraintdef(oid) from pg_constraint where conname = 'crm_campaigns_kind_check')
    = 'CHECK ((kind = ANY (ARRAY[''newsletter''::text, ''fundraising''::text, ''volunteer''::text])))', 'the kind check is the three kinds';
  delete from public.crm_campaigns where name like 'Test % Send';
end $$;

-- ---------------------------------------------------------------- first contact
do $$
begin
  perform set_config('request.jwt.claims', '', true);
  assert public.crm_email_first_contact(2001) is null, 'nobody signed in (the service role): null';
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.blocked@example.invalid","sub":"00000000-0000-0000-0000-000000000003"}', true);
  assert public.crm_email_first_contact(2001) is null, 'a blocked person: null';
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.member@example.invalid","sub":"00000000-0000-0000-0000-000000000001"}', true);
  assert public.crm_email_first_contact(2001) = true, 'unknown consent, no Hub email, no Keela open: a first contact';
  assert public.crm_email_first_contact(2008) = false, 'a delivered Hub email: not a first contact';
  assert public.crm_email_first_contact(2009) = true, 'only a test email: still a first contact';
  assert public.crm_email_first_contact(2010) = true, 'only a suppressed row: still a first contact';
  assert public.crm_email_first_contact(2011) = false, 'a failed row that was opened: not a first contact';
  assert public.crm_email_first_contact(2020) = false, 'a delayed row that was clicked: not a first contact';
  assert public.crm_email_first_contact(2012) = false, 'a Keela newsletter opened 30 days ago: not a first contact';
  assert public.crm_email_first_contact(2015) = false, 'a Keela open exactly 12 months ago is not before the cut-off: not a first contact';
  assert public.crm_email_first_contact(2013) = true, 'a Keela open 13 months ago: a first contact';
  assert public.crm_email_first_contact(2014) = true, 'a Keela date that is not YYYY-MM-DD counts as never opened: a first contact';
  assert public.crm_email_first_contact(2017) = true, 'implied consent that ran out, nothing else: a first contact';
  assert public.crm_email_first_contact(2006) = false and public.crm_email_first_contact(2007) = false, 'express or valid implied consent: not a first contact';
  assert public.crm_email_first_contact(2002) = false and public.crm_email_first_contact(2003) = false and public.crm_email_first_contact(2005) = false
     and public.crm_email_first_contact(2016) = false and public.crm_email_first_contact(2018) = false and public.crm_email_first_contact(99999) = false,
    'not allowed at all (unsubscribed, bounced, do-not-contact, no address, merged, missing): not a first contact';
  -- after a delivered Hub email, a first contact is one no more
  insert into public.crm_email_sends (contact_id, to_email, template_key, kind, status, is_test) values (2001, 'w282.2001@example.invalid', 'newsletter', 'newsletter', 'delivered', false);
  assert public.crm_email_first_contact(2001) = false, 'false after a delivered Hub email';
  delete from public.crm_email_sends where contact_id = 2001;
  insert into public.crm_email_sends (contact_id, to_email, template_key, kind, status, is_test) values (2001, 'w282.2001@example.invalid', 'newsletter', 'newsletter', 'sent', false);
  assert public.crm_email_first_contact(2001) = false, 'false after a sent Hub email';
  delete from public.crm_email_sends where contact_id = 2001;
  assert public.crm_email_first_contact(2001) = true, 'and true again once the row is gone';
  perform set_config('request.jwt.claims', '', true);
end $$;

-- ---------------------------------------------------------------- the first newsletter's two lists (E1)
do $$
declare r jsonb; v_allowed int; v_first int; m bigint[]; f bigint[]; v_err text; who text;
begin
  -- refused: nobody signed in, a member with no profile, another team's profile, a blocked marketing person
  foreach who in array array['', 'w281.member@example.invalid', 'w282.ops@example.invalid', 'w282.blockedmkt@example.invalid'] loop
    perform set_config('request.jwt.claims', case when who = '' then '' else '{"role":"authenticated","email":"' || who || '"}' end, true);
    begin
      perform public.wa282_newsletter_lists('Test refused');
      v_err := 'no error';
    exception when others then v_err := sqlerrm;
    end;
    assert v_err like 'not allowed%', 'wa282_newsletter_lists refuses ' || coalesce(nullif(who, ''), 'nobody signed in') || ' (' || v_err || ')';
  end loop;
  assert not exists (select 1 from public.crm_lists where name like 'Test refused%'), 'a refused call creates no list';

  -- the direct counts, as staff
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.member@example.invalid"}', true);
  select count(*) into v_allowed from public.crm_contacts c cross join lateral public.crm_email_permission(c.id, 'newsletter') p where c.merged_into is null and p.allowed;
  select count(*) into v_first from public.crm_contacts c where c.merged_into is null and public.crm_email_first_contact(c.id);
  assert v_first = 6, 'six first contacts in the fixture (' || v_first || ')';

  -- marketing builds them
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"w282.marketing@example.invalid"}', true);
  begin
    perform public.wa282_newsletter_lists('   ');
    v_err := 'no error';
  exception when others then v_err := sqlerrm;
  end;
  assert v_err = 'a name is needed', 'a blank name is refused (' || v_err || ')';
  r := public.wa282_newsletter_lists('Test November newsletter');
  assert (r ->> 'main')::int + (r ->> 'first_contacts')::int = v_allowed, 'main + first contacts = every contact allowed a newsletter (' || r::text || ', ' || v_allowed || ')';
  assert (r ->> 'first_contacts')::int = v_first, 'first contacts = the direct count';
  select member_ids into m from public.crm_lists where id = (r ->> 'main_list_id')::bigint and name = 'Test November newsletter: main' and kind = 'static' and created_by = 'w282.marketing@example.invalid';
  select member_ids into f from public.crm_lists where id = (r ->> 'first_contacts_list_id')::bigint and name = 'Test November newsletter: first contacts' and kind = 'static';
  assert cardinality(m) = (r ->> 'main')::int and cardinality(f) = (r ->> 'first_contacts')::int, 'the two static lists hold the counts it returned';
  assert f = array[2001, 2009, 2010, 2013, 2014, 2017]::bigint[], 'the first contacts list: ' || f::text;
  assert not (m && f), 'nobody is on both lists';
  assert m @> array[2006, 2007, 2008, 2011, 2012, 2015, 2020]::bigint[], 'express, implied, Hub-emailed and recent Keela openers are on the main list';
  assert not (m && array[2002, 2003, 2004, 2005, 2016, 2018, 2019]::bigint[]), 'unsubscribed, bounced, complained, do-not-contact, no address and merged are on neither';
  assert (select count(*) from (select unnest(m) union select unnest(f)) u) = v_allowed, 'together they are exactly the allowed contacts';

  -- an admin and the fundraising team may too
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.admin@example.invalid"}', true);
  r := public.wa282_newsletter_lists('Test admin');
  assert (r ->> 'main')::int + (r ->> 'first_contacts')::int = v_allowed, 'an admin gets the same counts';
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"w282.fundraising@example.invalid"}', true);
  r := public.wa282_newsletter_lists('Test fundraising');
  assert (r ->> 'first_contacts')::int = v_first, 'the fundraising team gets the same counts';
  perform set_config('request.jwt.claims', '', true);
end $$;

-- ---------------------------------------------------------------- grants, comments, the release line
do $$
begin
  assert not has_function_privilege('anon', 'public.crm_email_first_contact(bigint)', 'execute') and not has_function_privilege('anon', 'public.wa282_newsletter_lists(text)', 'execute')
     and not has_function_privilege('anon', 'public.crm_email_permission(bigint,text)', 'execute'), 'anon runs none of them';
  assert has_function_privilege('authenticated', 'public.crm_email_first_contact(bigint)', 'execute') and has_function_privilege('service_role', 'public.crm_email_first_contact(bigint)', 'execute')
     and has_function_privilege('authenticated', 'public.wa282_newsletter_lists(text)', 'execute') and has_function_privilege('service_role', 'public.wa282_newsletter_lists(text)', 'execute'),
    'signed-in users and the service role run the two new functions';
  assert has_function_privilege('authenticated', 'public.crm_email_permission(bigint,text)', 'execute') and has_function_privilege('service_role', 'public.crm_email_permission(bigint,text)', 'execute'),
    'crm_email_permission keeps its grants';
  assert (select prosecdef and provolatile = 's' from pg_proc where oid = 'public.crm_email_first_contact(bigint)'::regprocedure), 'crm_email_first_contact is stable and security definer';
  assert (select prosecdef from pg_proc where oid = 'public.wa282_newsletter_lists(text)'::regprocedure), 'wa282_newsletter_lists is security definer';
  assert (select proconfig::text from pg_proc where oid = 'public.crm_email_first_contact(bigint)'::regprocedure) = '{"search_path=\"\""}'
     and (select proconfig::text from pg_proc where oid = 'public.wa282_newsletter_lists(text)'::regprocedure) = '{"search_path=\"\""}', 'both pin an empty search_path';
  assert obj_description('public.crm_email_first_contact(bigint)'::regprocedure, 'pg_proc') like 'wave282:%'
     and obj_description('public.wa282_newsletter_lists(text)'::regprocedure, 'pg_proc') like 'wave282:%'
     and obj_description('public.crm_email_permission(bigint,text)'::regprocedure, 'pg_proc') like '%wave282, Steel''s rule of 5 Nov 2026%', 'the comments say what wave282 did';
  assert col_description('public.crm_campaigns'::regclass, (select attnum from pg_attribute where attrelid = 'public.crm_campaigns'::regclass and attname = 'kind')) like '%Since wave282%transactional is refused%',
    'the crm_campaigns.kind comment says transactional is refused';
  assert (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave282' and field = 'wave282') = 1, 'one release line';
end $$;

select 'w282sql: all assertions passed' as result;
rollback;
