-- Welfare Avenue Hub: wave294. Assertions for build/data/wa294_keela_tags.sql (Keela tag names). Assumes test/w281schema.sql, build/data/wa281_rules.sql,
-- test/w284schema.sql, build/data/wa284_import.sql and the wave294 migration are loaded. Everything runs in one transaction and ends with a rollback; any
-- failed assertion raises. Offline: node test/w294sql.mjs (PGlite). Every person is invented (Test ..., example.invalid, Keela ids KT94...).

begin;
create temp table w294ids (k text primary key, v bigint);
create function pg_temp.id(p text) returns bigint language sql as $$ select v from w294ids where k = p $$;

-- ---------------------------------------------------------------- the map
do $$
declare m jsonb := (select value::jsonb from public.app_config where key = 'keela_tag_map'); k text; n int := 0;
begin
  assert jsonb_typeof(m) = 'object', 'the map is an object';
  -- wave284's campaign, chapter and skip entries, exactly
  assert m -> 'Rally Paper Participant' = '{"campaign": "Rally Paper 2026", "part": "participant"}'::jsonb and m -> 'Flag Football 2025' = '{"campaign": "Football Fundraiser 2025", "part": "participant"}'::jsonb
     and m -> '2026 Gift Basket Volunteer' = '{"campaign": "Gift Basket Drive 2026", "part": "volunteer"}'::jsonb and m -> 'Toronto Contacts' = '{"chapter": "toronto"}'::jsonb
     and m -> 'Welcome Series Exit #1' = '{"skip": true}'::jsonb, 'the campaign, chapter and skip entries are wave284''s';
  assert m -> 'Toronto Volunteers' = '{"chapter": "toronto", "tag": "toronto volunteer"}'::jsonb and m -> 'Toronto Organizations' = '{"chapter": "toronto"}'::jsonb
     and m -> 'Welcome to WA #1 - Opened - Automation Trigger' = '{"skip": true}'::jsonb, 'Toronto Volunteers keeps its chapter and names the Hub tag; Toronto Organizations is a chapter; the welcome trigger is skipped';
  -- the three donor tags are renames now
  assert m -> 'Donor' = '{"tag": "donor"}'::jsonb and m -> 'Past Donor' = '{"tag": "past donor"}'::jsonb and m -> 'Reoccurring Donor' = '{"tag": "recurring donor"}'::jsonb, 'the donor tags are renames, not skips';
  foreach k in array array['Volunteer Server', 'Server', 'Volunteer Cook', 'Monthly Newsletter Subscriber', 'Volunteer Driver New', 'Reoccuring Volunteers', 'WA Team Applicants',
                           'Donated Essential Items', 'WA Admin', 'WA Admin 2026', 'Volunteer Applicant', 'Program Event Collaboration', 'Trajet Volunteers', 'Photographer',
                           'Workshop Opportunities', 'Partner', 'Corporate Fundraising', 'Team Leader Volunteer', 'Drop-Off', 'Pickup', 'Pending Location Check', 'Location Approved'] loop
    assert m ? k and (m -> k) ? 'tag', 'the map has a tag entry for ' || k;
    n := n + 1;
  end loop;
  assert m -> 'Volunteer Server' ->> 'tag' = 'server' and m -> 'Volunteer Cook' ->> 'tag' = 'cook' and m -> 'Monthly Newsletter Subscriber' ->> 'tag' = 'newsletter'
     and m -> 'Volunteer Driver New' ->> 'tag' = 'driver' and m -> 'Reoccuring Volunteers' ->> 'tag' = 'recurring volunteer' and m -> 'WA Team Applicants' ->> 'tag' = 'team applicant'
     and m -> 'Donated Essential Items' ->> 'tag' = 'donated items' and m -> 'WA Admin 2026' ->> 'tag' = 'wa admin' and m -> 'Program Event Collaboration' ->> 'tag' = 'program collaboration'
     and m -> 'Trajet Volunteers' ->> 'tag' = 'trajet volunteer' and m -> 'Team Leader Volunteer' ->> 'tag' = 'team leader' and m -> 'Corporate Fundraising' ->> 'tag' = 'corporate fundraising',
     'the renames name the Hub tags';
  assert (select count(*) from jsonb_each(m) e where e.value ? 'tag' and e.value ->> 'tag' <> lower(e.value ->> 'tag')) = 0, 'every Hub tag in the map is lower case';
  assert (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave294' and field = 'keela_tag_map') >= 1, 'the before and after value are recorded';
  assert (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave294' and field = 'wave294') = 1, 'one release line';
  assert (select old_value::jsonb from public.change_log where entity_id = 'wave294' and field = 'keela_tag_map' order by id desc limit 1) -> 'Donor' = '{"skip": true}'::jsonb, 'the recorded before value is wave284''s default';
end $$;

-- ---------------------------------------------------------------- the aliases
do $$
declare n int; prev text := '';
  r record;
begin
  select count(*) into n from public.crm_tag_aliases();
  assert n = 27, 'crm_tag_aliases gives 27 pairs (' || n || ')';
  assert exists (select 1 from public.crm_tag_aliases() a where a.alias = 'toronto volunteers' and a.tag = 'toronto volunteer'), 'toronto volunteers finds toronto volunteer';
  assert exists (select 1 from public.crm_tag_aliases() a where a.alias = 'volunteer server' and a.tag = 'server'), 'volunteer server finds server';
  assert exists (select 1 from public.crm_tag_aliases() a where a.alias = 'server' and a.tag = 'server'), 'server finds server';
  assert exists (select 1 from public.crm_tag_aliases() a where a.alias = 'wa admin 2026' and a.tag = 'wa admin'), 'wa admin 2026 finds wa admin';
  assert exists (select 1 from public.crm_tag_aliases() a where a.alias = 'reoccuring volunteers' and a.tag = 'recurring volunteer'), 'Keela''s own spelling is an alias';
  assert exists (select 1 from public.crm_tag_aliases() a where a.alias = 'donor' and a.tag = 'donor'), 'donor';
  assert not exists (select 1 from public.crm_tag_aliases() a where a.alias in ('toronto contacts', 'toronto organizations', 'welcome series exit #1', 'welcome to wa #1 - opened - automation trigger', 'rally paper participant', 'flag football 2025', '2026 gift basket volunteer')),
    'campaign, chapter-only and skip entries give no alias';
  assert not exists (select 1 from public.crm_tag_aliases() a where a.alias <> lower(a.alias) or a.tag <> lower(a.tag)), 'lower case throughout';
  for r in select a.alias from public.crm_tag_aliases() a loop
    assert r.alias >= prev, 'in alias order'; prev := r.alias;
  end loop;
  assert (select count(*) from (select distinct alias, tag from public.crm_tag_aliases()) d) = n, 'no repeated pair';
  -- the writer takes any boolean spelling of skip and a campaign before a tag: neither is an alias
  update public.app_config set value = (value::jsonb || '{"Test Skip Yes": {"skip": "yes", "tag": "x"}, "Test Skip False": {"skip": false, "tag": "y"}, "Test Camp Tag": {"campaign": "C", "tag": "z"}}'::jsonb)::text where key = 'keela_tag_map';
  assert not exists (select 1 from public.crm_tag_aliases() a where a.alias like 'test %'), 'an entry with skip or campaign gives no alias';
  assert (select count(*) from public.crm_tag_aliases()) = 27, 'and the others are unchanged';
  -- an unreadable map gives nothing, not an error
  update public.app_config set value = 'not json' where key = 'keela_tag_map';
  assert (select count(*) from public.crm_tag_aliases()) = 0, 'an unreadable map gives no rows';
  update public.app_config set value = '[]' where key = 'keela_tag_map';
  assert (select count(*) from public.crm_tag_aliases()) = 0, 'a map that is not an object gives no rows';
  update public.app_config set value = (select old_value from public.change_log where entity_id = 'wave294' and field = 'keela_tag_map' order by id desc limit 1) where key = 'keela_tag_map';
  update public.app_config set value = (select new_value from public.change_log where entity_id = 'wave294' and field = 'keela_tag_map' order by id desc limit 1) where key = 'keela_tag_map';
end $$;

-- ---------------------------------------------------------------- grants and comments
do $$
declare s regprocedure := 'public.crm_tag_aliases()'::regprocedure; w regprocedure := 'public.wa284_w_participation(bigint, bigint, boolean)'::regprocedure;
begin
  assert not has_function_privilege('anon', s, 'execute'), 'anon cannot run crm_tag_aliases';
  assert has_function_privilege('authenticated', s, 'execute'), 'authenticated can run crm_tag_aliases';
  assert has_function_privilege('service_role', s, 'execute'), 'the service role can run crm_tag_aliases (Send queues)';
  assert not exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where p.oid = s and a.grantee = 0), 'public has no grant on crm_tag_aliases';
  assert (select prosecdef from pg_proc where oid = s) and (select provolatile from pg_proc where oid = s) = 's', 'security definer and stable';
  assert (select proconfig::text from pg_proc where oid = s) like '%search_path=%', 'the search_path is pinned';
  assert obj_description(s, 'pg_proc') like 'wave294:%' and obj_description(w, 'pg_proc') like 'wave284 (changed by wave294):%', 'comments on both objects';
  -- the writer stays closed to the public
  assert not has_function_privilege('anon', w, 'execute') and not has_function_privilege('authenticated', w, 'execute') and has_function_privilege('service_role', w, 'execute'), 'the writer is still service role only';
  -- called as anon the function refuses; as authenticated it answers
  set local role anon;
  begin perform 1 from public.crm_tag_aliases(); assert false, 'anon ran crm_tag_aliases'; exception when insufficient_privilege then null; end;
  reset role;
  set local role authenticated;
  assert (select count(*) from public.crm_tag_aliases()) = 27, 'authenticated reads the aliases';
  reset role;
end $$;

-- ---------------------------------------------------------------- batch 7 with rename entries, on invented people
update public.app_config set value = '{}' where key in ('keela_keys', 'keela_campaign_types');
insert into public.crm_contacts (id, full_name, emails, tags, legacy_refs) overriding system value values
  (9401, 'Test Rename One', array['rename.one@example.invalid'], '{}', '{"keela": {"contact_id": "KT9401"}}'),
  (9402, 'Test Rename Two', array['rename.two@example.invalid'], array['Server'], '{"keela": {"contact_id": "KT9402"}}'),
  (9403, 'Test Rename Three', array['rename.three@example.invalid'], '{}', '{"keela": {"contact_id": "KT9403"}}'),
  (9404, 'Test Rename Four', array['rename.four@example.invalid'], array['donor'], '{"keela": {"contact_id": "KT9404"}}'),
  (9405, 'Test Rename Five', array['rename.five@example.invalid'], '{}', '{"keela": {"contact_id": "KT9405"}}'),
  (9406, 'Test Rename Six', array['rename.six@example.invalid'], '{}', '{"keela": {"contact_id": "KT9406"}}');
do $$
declare v_run bigint; v_file bigint; b bigint; r jsonb;
begin
  v_run := public.wa284_new_run('wave294 test', 'w294.admin@example.invalid');
  v_file := public.wa284_register(v_run, v_run || '/w294-contacts.json', 'keela_contacts_json');
  perform public.wa284_stage_rows(v_file, 0, $j$[
    {"Contact Id": "KT9401", "Contact Type": "Individual", "Primary Email": "rename.one@example.invalid",
     "Tags": ["Volunteer Server", "Server", "Donor", "Past Donor", "Reoccurring Donor", "WA Admin", "WA Admin 2026", "Welcome Series Exit #1", "Toronto Contacts", "Unmapped Test Label"]},
    {"Contact Id": "KT9402", "Contact Type": "Individual", "Primary Email": "rename.two@example.invalid", "Tags": ["volunteer server"]},
    {"Contact Id": "KT9403", "Contact Type": "Individual", "Primary Email": "rename.three@example.invalid",
     "Tags": ["Volunteer Cook", "Monthly Newsletter Subscriber", "Volunteer Driver New", "Reoccuring Volunteers", "WA Team Applicants", "Donated Essential Items", "Program Event Collaboration",
              "Trajet Volunteers", "Workshop Opportunities", "Partner", "Photographer", "Volunteer Applicant", "Corporate Fundraising", "Team Leader Volunteer", "Drop-Off", "Pickup",
              "Pending Location Check", "Location Approved"]},
    {"Contact Id": "KT9404", "Contact Type": "Individual", "Primary Email": "rename.four@example.invalid", "Tags": ["Donor"]},
    {"Contact Id": "KT9405", "Contact Type": "Individual", "Primary Email": "rename.five@example.invalid", "Tags": ["Toronto Volunteers", "Toronto Organizations"]},
    {"Contact Id": "KT9406", "Contact Type": "Individual", "Primary Email": "rename.six@example.invalid", "Tags": ["Volunteer Cook", "Cook", "Foo Raw", "foo raw"]}
  ]$j$::jsonb, 6);
  b := public.wa284_new_batch(v_run, 'participation');
  insert into w294ids values ('run', v_run), ('batch', b);
  r := public.wa284_compare(b);
  assert (select status from public.crm_import_batches where id = b) = 'compared', 'the participation batch compared (' || coalesce((select error from public.crm_import_batches where id = b), '') || ')';
  assert r #>> '{counts,skipped,tag skipped}' = '1' and r #>> '{counts,updated,crm_contact_chapters}' = '2', 'one tag skipped (the welcome series marker), two chapters (' || r::text || ')';
  assert (select tags from public.crm_contacts where id = 9401) = '{}'::text[], 'compare changes nothing';
  r := public.wa284_apply(b, 'w294.admin@example.invalid');
  assert (select status from public.crm_import_batches where id = b) = 'applied', 'the batch applied';
end $$;
do $$
declare t1 text[] := (select tags from public.crm_contacts where id = 9401); t3 text[] := (select tags from public.crm_contacts where id = 9403);
begin
  -- a rename adds the Hub tag and never the raw Keela label; donor tags land as donor, past donor, recurring donor; two entries naming one tag add it once
  assert cardinality(t1) = 6 and t1 @> array['Unmapped Test Label', 'donor', 'past donor', 'recurring donor', 'server', 'wa admin'],
    'contact 1 holds server, donor, past donor, recurring donor, wa admin once, and the unmapped label under its own name (' || array_to_string(t1, ' | ') || ')';
  assert not exists (select 1 from unnest(t1) t where lower(t) in ('volunteer server', 'reoccurring donor', 'wa admin 2026', 'welcome series exit #1', 'toronto contacts')), 'no raw Keela label of a mapped tag is added';
  assert exists (select 1 from public.crm_contact_chapters where contact_id = 9401 and chapter = 'toronto'), 'the chapter entry still works';
  -- Toronto Volunteers names a tag for the aliases, but batch 7 still files it as the chapter: the chapter wins, no tag is added
  assert exists (select 1 from public.crm_contact_chapters where contact_id = 9405 and chapter = 'toronto') and (select tags from public.crm_contacts where id = 9405) = '{}'::text[],
    'Toronto Volunteers and Toronto Organizations put the person in the Toronto chapter and add no tag';
  -- a raw label that matches a renamed tag is not added again; two raw labels differing in case add one
  assert (select tags from public.crm_contacts where id = 9406) = array['cook', 'Foo Raw'], 'Volunteer Cook and Cook add cook once; Foo Raw and foo raw add one (' || array_to_string((select tags from public.crm_contacts where id = 9406), ' | ') || ')';
  -- an existing tag is not duplicated, whatever the case
  assert (select tags from public.crm_contacts where id = 9402) = array['Server'], 'Server is not added again as server';
  assert (select tags from public.crm_contacts where id = 9404) = array['donor'], 'an existing donor tag is not duplicated';
  assert cardinality(t3) = 18 and t3 @> array['cook', 'corporate fundraising', 'donated items', 'drop-off', 'driver', 'location approved', 'newsletter', 'partner', 'pending location check',
    'photographer', 'pickup', 'program collaboration', 'recurring volunteer', 'team applicant', 'team leader', 'trajet volunteer', 'volunteer applicant', 'workshop opportunities'],
    'contact 3 holds the 18 Hub tags (' || array_to_string(t3, ' | ') || ')';
  -- the change records say what moved
  assert (select count(*) from public.crm_import_changes where batch_id = pg_temp.id('batch') and table_name = 'crm_contacts' and column_name = 'tags') = 3, 'a change record for each contact whose tags moved (3)';
end $$;
do $$
declare r jsonb;
begin
  -- the batch's own undo puts the tags back
  r := public.wa284_undo(pg_temp.id('batch'), 'w294.admin@example.invalid');
  assert (select tags from public.crm_contacts where id = 9401) = '{}'::text[] and (select tags from public.crm_contacts where id = 9403) = '{}'::text[], 'undo puts the tags back';
  assert (select tags from public.crm_contacts where id = 9402) = array['Server'] and (select tags from public.crm_contacts where id = 9404) = array['donor'], 'and leaves the others as they were';
  assert not exists (select 1 from public.crm_contact_chapters where contact_id in (9401, 9405)) and (select tags from public.crm_contacts where id = 9406) = '{}'::text[], 'and the chapter rows go';
end $$;

select 'w294sql: all assertions passed' as result;
rollback;
