-- Welfare Avenue Hub: wave295. Assertions for build/data/wa295_filters.sql (the Contacts filters).
-- Assumes test/w281schema.sql, build/data/wa281_rules.sql, test/w283schema.sql, build/data/wa283_page.sql, wave294 (or the stand-in in
-- test/w295schema.sql), test/w295schema.sql and the migration are loaded. One transaction, ends with a rollback; any failed assertion raises.
-- Offline: node test/w295sql.mjs (PGlite). Every row is invented (Test F... Filter, example.invalid).

begin;

-- the invented people's ids a filter selects, in order ("9501,9504"), or '-' for nobody
create function pg_temp.ids(p jsonb) returns text language sql as $$
  select coalesce(string_agg(x::text, ',' order by x), '-') from public.crm_list_preview(p) x where x between 9501 and 9599
$$;
create function pg_temp.one(k jsonb) returns text language sql as $$ select pg_temp.ids(jsonb_build_object('groups', jsonb_build_array(jsonb_build_object('all', jsonb_build_array(k))))) $$;

-- ---------------------------------------------------------------- the structure
do $$
begin
  assert position('wave295' in pg_get_functiondef('public.crm_contact_match(public.crm_contacts_v,jsonb)'::regprocedure)) > 0, 'crm_contact_match has the wave295 block';
  assert has_function_privilege('authenticated', 'public.crm_contact_match(public.crm_contacts_v,jsonb)', 'execute')
     and not has_function_privilege('anon', 'public.crm_contact_match(public.crm_contacts_v,jsonb)', 'execute'), 'crm_contact_match keeps its grants';
  assert obj_description('public.crm_contact_match(public.crm_contacts_v,jsonb)'::regprocedure, 'pg_proc') like '%wave295%', 'crm_contact_match says what wave295 added';
  assert (select prosecdef and provolatile = 's' from pg_proc where oid = 'public.crm_filter_contacts(jsonb)'::regprocedure), 'crm_filter_contacts is security definer and stable';
  assert has_function_privilege('authenticated', 'public.crm_filter_contacts(jsonb)', 'execute'), 'signed-in people may call crm_filter_contacts (it checks staff itself)';
  assert not has_function_privilege('anon', 'public.crm_filter_contacts(jsonb)', 'execute'), 'anon may not call crm_filter_contacts';
  assert not exists (select 1 from pg_proc p, aclexplode(p.proacl) a where p.oid = 'public.crm_filter_contacts(jsonb)'::regprocedure and a.grantee = 0),
    'PUBLIC has no execute on crm_filter_contacts';
  assert (select array_agg(a.grantee::regrole::text order by a.grantee::regrole::text) from pg_proc p, aclexplode(p.proacl) a
           where p.oid = 'public.crm_filter_contacts(jsonb)'::regprocedure and a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner) = array['authenticated'],
    'only authenticated (besides the owner) may execute crm_filter_contacts';
  assert obj_description('public.crm_filter_contacts(jsonb)'::regprocedure, 'pg_proc') like 'wave295:%', 'crm_filter_contacts has a comment';
  assert (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave295' and field = 'wave295') = 1, 'one release line';
  assert position('crm_filter_prepare' in pg_get_functiondef('public.crm_list_preview(jsonb)'::regprocedure)) > 0, 'crm_list_preview prepares the filter once';
  assert public.crm_filter_prepare('{"groups":[{"all":[{"f":"tag","op":"has","v":["Volunteer Server","Cook"]},{"f":"city","op":"contains","v":"x"}]}]}')
       = '{"groups":[{"all":[{"f":"tag","op":"has","v":["Volunteer Server","Cook"],"w295sets":[["volunteer server","server"],["cook"]]},{"f":"city","op":"contains","v":"x"}]}]}'::jsonb,
    'crm_filter_prepare gives each tag value its names (itself and its Hub tag), and leaves other conditions alone';
  assert public.crm_filter_prepare('{"kind":"volunteer"}') = '{"kind":"volunteer"}'::jsonb, 'a flat filter comes back as it was';
  assert public.crm_filter_prepare('{"groups":[{"x":1}]}') = '{"groups":[{"x":1}]}'::jsonb, 'a group without all comes back as it was';
  assert (select count(*) from public.crm_contacts_v c where c.id between 9501 and 9599 and public.crm_contact_match(c, '{"f":"tag","op":"has","v":"volunteer server","w295sets":[["nothing"]]}')) = 0,
    'crm_contact_match uses the names it is handed';
  assert (select string_agg(c.id::text, ',' order by c.id) from public.crm_contacts_v c where c.id between 9501 and 9599 and public.crm_contact_match(c, '{"f":"tag","op":"has","v":"volunteer server"}')) = '9501,9504',
    'called directly (no names handed over), it reads the Keela names itself';
end $$;

-- ---------------------------------------------------------------- field
do $$
begin
  assert pg_temp.one('{"f":"field","key":"w295_team","op":"set"}') = '9501,9502', 'field set: a filled-in choice (an empty string is not filled in)';
  assert pg_temp.one('{"f":"field","key":"w295_team","op":"empty"}') = '9503,9504', 'field empty: no row, or an empty string';
  assert pg_temp.one('{"f":"field","key":"w295_nope","op":"set"}') = '-', 'an unknown key matches nobody (set)';
  assert pg_temp.one('{"f":"field","key":"w295_nope","op":"empty"}') = '-', 'an unknown key matches nobody (empty)';
  assert pg_temp.one('{"f":"field","key":"w295_nope","op":"not"}') = '-', 'an unknown key matches nobody (not)';
  assert pg_temp.one('{"f":"field","op":"set"}') = '-', 'no key matches nobody';
  assert pg_temp.one('{"f":"field","key":"w295_unused","op":"empty"}') = '9501,9502,9503,9504', 'a field nobody filled in is empty for everyone';
  assert pg_temp.one('{"f":"field","key":"w295_team","op":"is","v":"quest"}') = '9501', 'field is: one choice, any case';
  assert pg_temp.one('{"f":"field","key":"w295_team","op":"is","v":["Quest","Logic"]}') = '9501,9502', 'field is: any of several choices';
  assert pg_temp.one('{"f":"field","key":"w295_team","op":"any","v":["Logic"]}') = '9502', 'field any';
  assert pg_temp.one('{"f":"field","key":"w295_team","op":"is","v":[]}') = '-', 'field is with no choice matches nobody';
  assert pg_temp.one('{"f":"field","key":"w295_positions","op":"any","v":["cook"]}') = '9501', 'multi: one of the chosen options';
  assert pg_temp.one('{"f":"field","key":"w295_positions","op":"any","v":["Driver","Cook"]}') = '9501,9502', 'multi: any of the chosen options';
  assert pg_temp.one('{"f":"field","key":"w295_positions","op":"is","v":"Server"}') = '9501', 'multi: is with one value';
  assert pg_temp.one('{"f":"field","key":"w295_positions","op":"set"}') = '9501,9502', 'multi: an empty list is not filled in';
  assert pg_temp.one('{"f":"field","key":"w295_positions","op":"contains","v":"riv"}') = '9502', 'multi: contains looks in each option';
  assert pg_temp.one('{"f":"field","key":"w295_age16","op":"is","v":"yes"}') = '9501', 'yes/no: yes (stored true)';
  assert pg_temp.one('{"f":"field","key":"w295_age16","op":"is","v":"no"}') = '9502,9504', 'yes/no: no (stored "no" and false)';
  assert pg_temp.one('{"f":"field","key":"w295_age16","op":"is","v":true}') = '9501', 'yes/no: a JSON true works as yes';
  assert pg_temp.one('{"f":"field","key":"w295_age16","op":"empty"}') = '9503', 'yes/no: false is filled in (a no is an answer)';
  assert pg_temp.one('{"f":"field","key":"w295_first_day","op":"before","v":"2026-01-01"}') = '9501', 'date before';
  assert pg_temp.one('{"f":"field","key":"w295_first_day","op":"after","v":"2025-12-31"}') = '9502', 'date after';
  assert pg_temp.one('{"f":"field","key":"w295_first_day","op":"after","v":"2026-01-15"}') = '-', 'date after is strict';
  assert pg_temp.one('{"f":"field","key":"w295_first_day","op":"before","v":"not a date"}') = '-', 'a value that is not a date matches nobody, and nothing fails';
  assert pg_temp.one('{"f":"field","key":"w295_first_day","op":"before","v":""}') = '-', 'an empty date matches nobody';
  assert pg_temp.one('{"f":"field","key":"w295_shifts","op":"before","v":"10"}') = '9501', 'number: less than (3 < 10; text "12" is a number too)';
  assert pg_temp.one('{"f":"field","key":"w295_shifts","op":"after","v":"10"}') = '9502', 'number: more than';
  assert pg_temp.one('{"f":"field","key":"w295_shifts","op":"is","v":"3.0"}') = '9501', 'number: is compares numbers (3.0 = 3)';
  assert pg_temp.one('{"f":"field","key":"w295_shifts","op":"is","v":"abc"}') = '-', 'number: is with a word matches nobody';
  assert pg_temp.one('{"f":"field","key":"w295_insta","op":"contains","v":"FA_"}') = '9501', 'text contains, any case';
  assert pg_temp.one('{"f":"field","key":"w295_insta","op":"empty"}') = '9502,9503,9504', 'text: a JSON null is empty';
  assert pg_temp.one('{"f":"field","key":"w295_insta","op":"bogus"}') = '-', 'an unknown operator matches nobody';
end $$;

-- ---------------------------------------------------------------- kind, role, tag with several values; tag aliases
do $$
begin
  assert pg_temp.one('{"f":"kind","op":"is","v":["partner","supporter"]}') = '9502,9504', 'kind: any of (Fb is a supporter and has an organisation, so a partner too)';
  assert pg_temp.one('{"f":"kind","op":"all","v":["volunteer","donor"]}') = '9503', 'kind: every one';
  assert pg_temp.one('{"f":"kind","op":"none","v":["volunteer"]}') = '9502,9504', 'kind: none of';
  assert pg_temp.one('{"f":"kind","op":"not","v":["volunteer","partner"]}') = '-', 'kind: not with a list is none of';
  assert pg_temp.one('{"f":"kind","op":"any","v":"volunteer"}') = '9501,9503', 'kind: op any with one value';
  assert pg_temp.one('{"f":"kind","op":"is","v":["donor"]}') = '9503', 'kind: donor through the list keeps the donor rule';
  assert pg_temp.one('{"f":"role","op":"is","v":["cook","driver"]}') = '9504', 'role: any of';
  assert pg_temp.one('{"f":"role","op":"none","v":["cook"]}') = '9501,9502,9503', 'role: none of';
  assert pg_temp.one('{"f":"tag","op":"has","v":["server"]}') = '9501,9504', 'tag: a list of one, any case (Server)';
  assert pg_temp.one('{"f":"tag","op":"all","v":["server","photographer"]}') = '9504', 'tag: every one';
  assert pg_temp.one('{"f":"tag","op":"all","v":"server"}') = '9501,9504', 'tag: all with one value';
  assert pg_temp.one('{"f":"tag","op":"none","v":["donor","server"]}') = '9503', 'tag: none of';
  assert pg_temp.one('{"f":"tag","op":"all","v":[]}') = '-', 'tag: all of an empty list matches nobody';
  assert pg_temp.one('{"f":"tag","op":"none","v":[]}') = '-', 'tag: none of an empty list matches no one (fail closed)';
  assert pg_temp.one('{"f":"tag","op":"none","v":[" ",""]}') = '-', 'tag: none of a list of blanks matches no one';
  assert pg_temp.one('{"f":"kind","op":"not","v":[]}') = '-', 'kind: not with an empty list matches no one';
  assert pg_temp.one('{"f":"role","op":"none","v":[]}') = '-', 'role: none of an empty list matches no one';
  assert pg_temp.one('{"f":"tag","op":"has","v":["server",""]}') = '9501,9504', 'a blank inside a list is left out, the rest counts';
  -- M1: a Keela name means its Hub tag or itself, nothing more
  assert pg_temp.one('{"f":"tag","op":"has","v":"volunteer server"}') = pg_temp.one('{"f":"tag","op":"has","v":["server","volunteer server"]}'), 'alias equivalence: a Keela name = its Hub tag or the name itself';
  assert pg_temp.one('{"f":"tag","op":"not","v":"volunteer server"}') = pg_temp.one('{"f":"tag","op":"none","v":["server","volunteer server"]}'), 'alias equivalence with not';
  assert pg_temp.one('{"f":"tag","op":"has","v":"photographer"}') = pg_temp.one('{"f":"tag","op":"has","v":["photographer"]}'), 'a tag that is not a Keela name: one value or a list of one, the same';
  assert pg_temp.one('{"f":"tag","op":"has","v":"Volunteer Server"}') = '9501,9504', 'tag: a Keela name finds its Hub tag (crm_tag_aliases)';
  assert pg_temp.one('{"f":"tag","op":"not","v":"volunteer server"}') = '9502,9503', 'tag: not with a Keela name';
  assert pg_temp.one('{"f":"tag","op":"has","v":["monthly newsletter subscriber"]}') = '9501', 'tag: a Keela name in a list';
  assert pg_temp.one('{"f":"tag","op":"all","v":["Volunteer Server","newsletter"]}') = '9501', 'tag: all, a Keela name and a Hub tag';
  assert pg_temp.one('{"f":"tag","op":"has","v":"donor"}') = '9502', 'tag: an alias that is the tag itself behaves as before';
end $$;

-- ---------------------------------------------------------------- chapter, dnc, phone, org, job_title
do $$
begin
  assert pg_temp.one('{"f":"chapter","op":"is","v":"montreal"}') = '9502,9503,9504', 'chapter montreal: the Montreal row, or no chapter row at all';
  assert pg_temp.one('{"f":"chapter","op":"is","v":"Toronto"}') = '9501,9504', 'chapter toronto (any case)';
  assert pg_temp.one('{"f":"chapter","op":"not","v":"montreal"}') = '9501', 'chapter not montreal';
  assert pg_temp.one('{"f":"chapter","op":"is","v":"ottawa"}') = '-', 'a chapter nobody has';
  assert pg_temp.one('{"f":"dnc","op":"is"}') = '9502', 'do not contact is on';
  assert pg_temp.one('{"f":"dnc","op":"not"}') = '9501,9503,9504', 'do not contact is off';
  assert pg_temp.one('{"f":"phone","op":"has"}') = '9501', 'has a phone (a blank one does not count)';
  assert pg_temp.one('{"f":"phone","op":"none"}') = '9502,9503,9504', 'has no phone';
  assert pg_temp.one('{"f":"org","op":"contains","v":"bakery"}') = '9502', 'organisation from Partners, any case';
  assert pg_temp.one('{"f":"org","op":"contains","v":"School"}') = '9504', 'organisation from the volunteer record';
  assert pg_temp.one('{"f":"org","op":"contains","v":""}') = '-', 'organisation contains nothing: no one (fail closed)';
  assert pg_temp.one('{"f":"org","op":"not","v":"  "}') = '-', 'organisation not blank: no one';
  assert pg_temp.one('{"f":"org","op":"not","v":"bakery"}') = '9501,9503,9504', 'organisation not';
  assert pg_temp.one('{"f":"job_title","op":"contains","v":"cook"}') = '9501', 'job title contains (an empty title never matches)';
  assert pg_temp.one('{"f":"job_title","op":"not","v":"cook"}') = '9502,9503,9504', 'job title does not contain';
end $$;

-- ---------------------------------------------------------------- fail closed: shapes that must never widen (B1, B2, B3, B4)
do $$
declare k text;
begin
  -- B1: unknown or missing fields
  foreach k in array array['{"f":"birth","op":"is","v":"x"}', '{}', '{"op":"not"}', '{"f":"","op":"is","v":"x"}', '{"f":"Tag","op":"has","v":"server"}', '{"f":null}',
                           '{"f":"future_field","op":"not","v":"x"}', '{"f":"KIND","op":"not","v":"volunteer"}'] loop
    assert pg_temp.one(k::jsonb) = '-', 'an unknown or missing field matches no one: ' || k;
  end loop;
  -- B2: blank values on every condition that takes text
  foreach k in array array['{"f":"kind","op":"is","v":""}', '{"f":"kind","op":"not","v":" "}', '{"f":"role","op":"not","v":""}', '{"f":"tag","op":"not","v":""}',
                           '{"f":"tag","op":"has","v":"  "}', '{"f":"perm","op":"not","v":""}', '{"f":"city","op":"contains","v":""}', '{"f":"city","op":"not","v":" "}',
                           '{"f":"language","op":"is","v":""}', '{"f":"source","op":"not","v":""}', '{"f":"search","op":"contains","v":"   "}',
                           '{"f":"chapter","op":"not","v":""}', '{"f":"org","op":"contains"}', '{"f":"job_title","op":"not","v":""}',
                           '{"f":"field","key":"w295_team","op":"is","v":""}', '{"f":"field","key":"w295_insta","op":"contains","v":" "}',
                           '{"f":"field","key":"w295_team","op":"any","v":[]}', '{"f":"field","key":"w295_first_day","op":"after","v":""}',
                           '{"f":"field","key":"w295_shifts","op":"before","v":""}'] loop
    assert pg_temp.one(k::jsonb) = '-', 'a blank value matches no one: ' || k;
  end loop;
  -- yes/no: only a recognised yes or no; a stored answer that is neither never matches
  assert pg_temp.one('{"f":"field","key":"w295_age16","op":"is","v":"banana"}') = '-', 'yes/no with junk matches no one';
  assert pg_temp.one('{"f":"field","key":"w295_age16","op":"is","v":"non"}') = '9502,9504', 'yes/no: non is no';
  -- B3: a list or object where one value is meant
  foreach k in array array['{"f":"chapter","op":"not","v":["montreal","toronto"]}', '{"f":"chapter","op":"is","v":["toronto"]}', '{"f":"org","op":"not","v":["bakery"]}',
                           '{"f":"job_title","op":"none","v":["cook","chef"]}', '{"f":"city","op":"not","v":["Montreal"]}', '{"f":"perm","op":"not","v":["unsub"]}',
                           '{"f":"language","op":"not","v":["fr"]}', '{"f":"source","op":"not","v":["keela"]}', '{"f":"search","op":"contains","v":["test"]}',
                           '{"f":"field","key":"w295_first_day","op":"before","v":["2026-01-01"]}', '{"f":"field","key":"w295_insta","op":"contains","v":["fa"]}',
                           '{"f":"dnc","op":"not","v":["x"]}', '{"f":"served","op":"never","v":["x"]}', '{"f":"kind","op":"not","v":{"a":1}}', '{"f":"tag","op":"none","v":{}}'] loop
    assert pg_temp.one(k::jsonb) = '-', 'a list or object where one value is meant matches no one: ' || k;
  end loop;
  -- the new fields take only their own operators
  foreach k in array array['{"f":"chapter","op":"banana","v":"toronto"}', '{"f":"dnc","op":"has"}', '{"f":"org","op":"is","v":"bakery"}', '{"f":"field","key":"w295_team","op":"not","v":"Quest"}'] loop
    assert pg_temp.one(k::jsonb) = '-', 'an operator a new field does not take matches no one: ' || k;
  end loop;
  -- N2: dates in one form only
  assert pg_temp.one('{"f":"field","key":"w295_first_day","op":"before","v":"01/01/2026"}') = '-', 'a date not written YYYY-MM-DD matches no one';
  -- B4: no group, or a group with no condition, matches no one (live matched everyone)
  assert pg_temp.ids('{"groups":[]}') = '-', 'no group matches no one';
  assert pg_temp.ids('{"groups":[{"all":[]}]}') = '-', 'a group with no condition matches no one';
  assert pg_temp.ids('{"groups":[{"all":[]},{"all":[{"f":"dnc","op":"is"}]}]}') = '9502', 'an empty group next to a real one adds no one';
  assert pg_temp.ids('{"groups":[{"x":1}]}') = '-', 'a group without all matches no one';
  assert pg_temp.ids('{"kind":"volunteer"}') = '9501,9503', 'the flat filter (no groups) works as before';
end $$;

-- ---------------------------------------------------------------- fix round 2 (X1, X2, X5, the flat filter)
do $$
declare k text; e text;
begin
  -- X1: a list whose items are not all text matches no one, whatever the operator
  foreach k in array array['{"f":"kind","op":"not","v":[{}]}', '{"f":"tag","op":"not","v":[[]]}', '{"f":"kind","op":"not","v":[1]}', '{"f":"role","op":"none","v":[true]}',
                           '{"f":"tag","op":"none","v":[null]}', '{"f":"kind","op":"any","v":["volunteer",1]}', '{"f":"tag","op":"has","v":["server",{}]}',
                           '{"f":"field","key":"w295_team","op":"any","v":[["Quest"]]}'] loop
    assert pg_temp.one(k::jsonb) = '-', 'a list with an item that is not text matches no one: ' || k;
  end loop;
  -- X2: conditions that are not a list: no one, and no error
  foreach k in array array['{"groups":[{"all":{}}]}', '{"groups":[{"all":"x"}]}', '{"groups":[{"all":{}},{"all":7}]}', '{"groups":[1,"x",null]}'] loop
    assert pg_temp.ids(k::jsonb) = '-', 'a group whose conditions are not a list matches no one: ' || k;
  end loop;
  assert pg_temp.ids('{"groups":[{"all":{}},{"all":[{"f":"dnc","op":"is"}]}]}') = '9502', 'a malformed group next to a real one adds no one';
  -- X5: values outside the closed sets match no one, with not as well
  foreach k in array array['{"f":"chapter","op":"not","v":"tor"}', '{"f":"chapter","op":"is","v":"ottawa"}', '{"f":"kind","op":"not","v":"banana"}', '{"f":"kind","op":"is","v":"Volunteer"}',
                           '{"f":"kind","op":"none","v":["volunteer","banana"]}', '{"f":"perm","op":"not","v":"maybe"}', '{"f":"perm","op":"is","v":"Express"}'] loop
    assert pg_temp.one(k::jsonb) = '-', 'a value outside its closed set matches no one: ' || k;
  end loop;
  assert pg_temp.one('{"f":"chapter","op":"is","v":"Toronto"}') = pg_temp.one('{"f":"chapter","op":"is","v":"toronto"}'), 'a chapter in any case still works';
  assert pg_temp.one('{"f":"kind","op":"not","v":["donor"]}') = pg_temp.one('{"f":"kind","op":"not","v":"donor"}'), 'a known contact type with not still works';
  -- the flat filter: an object with neither a groups list nor a flat key with a value matches no one; real flat filters work as before
  foreach k in array array['{}', '{"groups":{}}', '{"groups":null}', '{"groups":"x"}', '{"kind":""}', '{"q":"   "}', '{"tags":[]}', '{"tags":[" ",1]}', '{"nothing":"x"}', '[]', '"x"', 'null', '7'] loop
    assert pg_temp.ids(k::jsonb) = '-', 'no groups and no flat key matches no one: ' || k;
  end loop;
  assert pg_temp.ids(null) = '-', 'a null filter matches no one';
  assert pg_temp.ids('{"tags":["server"]}') <> '-' and pg_temp.ids('{"act":"review"}') is not null and pg_temp.ids('{"groups":{},"kind":"volunteer"}') = '9501,9503',
    'real flat filters still go to the flat engine';
  assert (select count(*) from public.crm_list_preview_flat('{}')) = (select count(*) from public.crm_contacts_v where merged_into is null), 'crm_list_preview_flat itself is unchanged';
end $$;

-- ---------------------------------------------------------------- fix round 3 (Y1 flat act, Y3 chapters from crm_chapters)
do $$
declare k text;
begin
  foreach k in array array['{"act":"bogus"}', '{"kind":"volunteer","act":"bogus"}', '{"act":5}', '{"act":{}}', '{"tags":["server"],"act":"Served"}', '{"groups":null,"act":"x"}'] loop
    assert pg_temp.ids(k::jsonb) = '-', 'a flat act the CRM does not have matches no one: ' || k;
  end loop;
  foreach k in array array['served12', 'served', 'never', 'review', 'noemail', 'new30'] loop
    assert pg_temp.ids(jsonb_build_object('act', k)) = coalesce((select string_agg(x::text, ',' order by x) from public.crm_list_preview_flat(jsonb_build_object('act', k)) x where x between 9501 and 9599), '-'),
      'a known flat act answers as the flat engine does: ' || k;
  end loop;
  assert pg_temp.ids('{"kind":"volunteer","act":""}') = '9501,9503', 'a blank act is ignored, as before';
  -- chapters come from crm_chapters: a code an admin adds can be filtered on at once; one that is not there matches no one
  assert pg_temp.one('{"f":"chapter","op":"not","v":"ottawa"}') = '-', 'a chapter not in crm_chapters matches no one';
  insert into public.crm_chapters (code, name_en, name_fr, active, mail_route, ops_team, sort) values ('ottawa', 'Ottawa', 'Ottawa', true, 'volunteer', 'opsmtl', 9);
  assert pg_temp.one('{"f":"chapter","op":"not","v":"ottawa"}') = '9501,9502,9503,9504' and pg_temp.one('{"f":"chapter","op":"is","v":"Ottawa"}') = '-',
    'once ottawa is in crm_chapters it can be filtered on (nobody is in it yet)';
  delete from public.crm_chapters where code = 'ottawa';
  assert pg_temp.one('{"f":"chapter","op":"is","v":"toronto"}') <> '-' and pg_temp.one('{"f":"chapter","op":"is","v":"montreal"}') <> '-', 'montreal and toronto still work';
end $$;

-- ---------------------------------------------------------------- groups: and inside one, or between them; merged people never
do $$
begin
  assert pg_temp.ids('{"groups":[{"all":[{"f":"dnc","op":"is"}]},{"all":[{"f":"phone","op":"has"}]}]}') = '9501,9502', 'or between groups';
  assert pg_temp.ids('{"groups":[{"all":[{"f":"chapter","op":"is","v":"toronto"},{"f":"tag","op":"has","v":["server"]},{"f":"field","key":"w295_age16","op":"is","v":"yes"}]}]}') = '9501', 'and inside a group';
  assert pg_temp.ids('{"groups":[{"all":[{"f":"tag","op":"has","v":["server"]},{"f":"kind","op":"is","v":["volunteer","partner"]},{"f":"chapter","op":"is","v":"toronto"},{"f":"phone","op":"none"},{"f":"dnc","op":"not"},{"f":"org","op":"contains","v":"school"}]}]}') = '9504', 'six conditions';
  assert position('9505' in pg_temp.one('{"f":"tag","op":"has","v":["server"]}')) = 0, 'a merged contact is never in a result';
end $$;

-- ---------------------------------------------------------------- crm_filter_contacts: who may call it
-- staff with the CRM (a member): the same ids as crm_list_preview
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.member@example.invalid"}', true);
set local role authenticated;
do $$
begin
  assert (select string_agg(id::text, ',' order by id) from public.crm_filter_contacts('{"groups":[{"all":[{"f":"tag","op":"has","v":["server"]}]}]}') where id between 9501 and 9599) = '9501,9504',
    'a member with the CRM gets the ids';
  assert (select string_agg(id::text, ',' order by id) from public.crm_filter_contacts('{"kind":"volunteer"}') where id between 9501 and 9599) = '9501,9503', 'a flat filter (an older list) is answered too';
  assert not exists (select 1 from public.crm_filter_contacts('{}')) and not exists (select 1 from public.crm_filter_contacts('{"act":"bogus"}')), 'a flat filter with nothing usable matches no one';
end $$;
do $$
declare m text; e text;
begin
  foreach m in array array['{"groups":[]}', '{"groups":[{"all":[]}]}', '{"groups":[{"x":1}]}', '{"groups":[{"all":{}}]}', '{"groups":[{"all":"x"}]}'] loop
    e := '';
    begin perform public.crm_filter_contacts(m::jsonb); exception when others then e := sqlerrm; end;
    assert e in ('A filter needs at least one condition.', 'The filter is not in the right shape: it needs {"groups": [...]}.'), 'a filter with no condition is refused (' || m || ': ' || e || ')';
  end loop;
end $$;
do $$
declare m text := '';
begin
  begin perform public.crm_filter_contacts('[1,2]'); exception when others then m := sqlerrm; end;
  assert m like 'The filter is not in the right shape%', 'a filter that is not an object is refused in plain words (' || m || ')';
end $$;
reset role;
-- signed in without the CRM, blocked, or not signed in: refused in plain words
do $$
declare who text; m text; st text;
begin
  foreach who in array array['w281.nocrm@example.invalid', 'w281.blocked@example.invalid', 'someone@example.invalid', ''] loop
    perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'email', who)::text, true);
    m := ''; st := '';
    begin perform public.crm_filter_contacts('{"groups":[{"all":[{"f":"dnc","op":"is"}]}]}'); exception when others then m := sqlerrm; st := sqlstate; end;
    assert m = 'Only the Welfare Avenue team, with the CRM in their apps, can filter the contacts.' and st = '42501', 'refused with 42501 for ' || coalesce(nullif(who, ''), 'nobody') || ' (' || st || ' ' || m || ')';
  end loop;
end $$;
-- the same refusal as the authenticated role itself (the way PostgREST calls it): staff without the CRM and a non-staff person get 42501
set local role authenticated;
do $$
declare who text; st text;
begin
  foreach who in array array['w281.nocrm@example.invalid', 'someone@example.invalid'] loop
    perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'email', who)::text, true);
    st := '';
    begin perform public.crm_filter_contacts('{"groups":[{"all":[{"f":"dnc","op":"is"}]}]}'); exception when others then st := sqlstate; end;
    assert st = '42501', 'as the authenticated role, refused with 42501 for ' || who || ' (' || st || ')';
  end loop;
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
do $$
declare e text := '';
begin
  begin perform public.crm_filter_contacts('{"groups":[{"all":[{"f":"dnc","op":"is"}]}]}'); exception when others then e := sqlerrm; end;
  assert e like 'permission denied%', 'anon cannot call crm_filter_contacts at all (' || e || ')';
end $$;
reset role;

-- ---------------------------------------------------------------- mail-send's way in: the service role evaluates a list with a tag condition
do $$ begin assert has_function_privilege('service_role', 'public.crm_tag_aliases()', 'execute'), 'the service role may read the tag aliases (mail-send)'; end $$;
set local role service_role;
do $$
begin
  assert (select string_agg(x::text, ',' order by x) from public.crm_list_preview('{"groups":[{"all":[{"f":"tag","op":"has","v":"Volunteer Server"}]}]}') x where x between 9501 and 9599) = '9501,9504',
    'the service role builds a Send''s queue from a list with a tag condition';
end $$;
reset role;

select 'w295sql: all assertions passed' as result;
rollback;
