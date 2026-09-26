-- wa133 dry run: run after wa133_org.sql in ONE transaction; it always ends in an exception, so nothing stays.
do $t$
declare
  res jsonb := '{}'::jsonb; x jsonb; e text; n int;
  s_ian bigint; s_kah bigint; s_joy bigint; s_sor bigint; s_edu bigint; s_tate bigint; s_karan bigint; s_mary bigint; s_ahmed bigint; s_suh bigint; s_open bigint; s_new bigint; m_new bigint;
begin
  perform set_config('request.jwt.claims', '{"email":"steel.macdonald@welfareavenue.com","role":"authenticated"}', true);
  select jsonb_build_object('seats', count(*), 'execs', count(*) filter (where kind = 'exec'), 'heads', count(*) filter (where kind = 'staff' and reports_to is null),
      'head_names', (select jsonb_agg(m.name order by m.name) from public.org_positions p join public.team_members m on m.id = p.member_id where p.kind = 'staff' and p.reports_to is null),
      'unplaced', (select count(*) from public.team_members m where m.active is not false and m.department <> 'board' and not exists (select 1 from public.org_positions p where p.member_id = m.id)))
    into x from public.org_positions;
  res := res || jsonb_build_object('seed', x, 'editor', public.wa_org_editor());
  select p.id into s_ian from public.org_positions p join public.team_members m on m.id = p.member_id where m.name = 'Ian';
  select p.id into s_kah from public.org_positions p join public.team_members m on m.id = p.member_id where m.name = 'Kahkashan';
  select p.id into s_joy from public.org_positions p join public.team_members m on m.id = p.member_id where m.name = 'Joy';
  select p.id into s_sor from public.org_positions p join public.team_members m on m.id = p.member_id where m.name = 'Soraya';
  select p.id into s_edu from public.org_positions p join public.team_members m on m.id = p.member_id where m.name = 'Eduardo de Freitas';
  select p.id into s_tate from public.org_positions p join public.team_members m on m.id = p.member_id where m.name = 'Tate';
  select p.id into s_karan from public.org_positions p join public.team_members m on m.id = p.member_id where m.name = 'Karan';
  select p.id into s_mary from public.org_positions p join public.team_members m on m.id = p.member_id where m.name = 'Mary';
  select p.id into s_ahmed from public.org_positions p join public.team_members m on m.id = p.member_id where m.name = 'Ahmed';
  select p.id into s_suh from public.org_positions p join public.team_members m on m.id = p.member_id where m.name = 'Suhaib';
  res := res || jsonb_build_object('cindy_to_suhaib', (select p.reports_to = s_suh from public.org_positions p join public.team_members m on m.id = p.member_id where m.name = 'Cindy'),
    'tuna_to_valex', (select mg.name from public.org_positions p join public.team_members m on m.id = p.member_id join public.org_positions g on g.id = p.reports_to join public.team_members mg on mg.id = g.member_id where m.name = 'Tuna'));

  x := public.org_move(s_joy, s_kah);
  res := res || jsonb_build_object('m1_move', x, 'm1_joy_under_kah', (select reports_to = s_kah from public.org_positions where id = s_joy));
  begin perform public.org_move(s_ian, s_edu); res := res || jsonb_build_object('m2_cycle', 'ALLOWED'); exception when others then res := res || jsonb_build_object('m2_cycle', sqlerrm); end;
  begin perform public.org_move(s_suh, s_ian); res := res || jsonb_build_object('m3_exec', 'ALLOWED'); exception when others then res := res || jsonb_build_object('m3_exec', sqlerrm); end;
  x := public.org_set_reports(s_kah, array[s_joy, s_sor]);
  res := res || jsonb_build_object('r1', x, 'r1_sor', (select reports_to = s_kah from public.org_positions where id = s_sor));
  x := public.org_set_reports(s_kah, array[s_joy]);
  res := res || jsonb_build_object('r2', x, 'r2_sor_up', (select reports_to is null from public.org_positions where id = s_sor));
  begin perform public.org_set_reports(s_edu, array[s_ian]); res := res || jsonb_build_object('r3_cycle', 'ALLOWED'); exception when others then res := res || jsonb_build_object('r3_cycle', sqlerrm); end;

  x := public.org_add_opening(s_tate, 'Volunteer coordinator', 'opsto', 'hiring', 'Recruiting now');
  s_open := (x->>'id')::bigint;
  res := res || jsonb_build_object('o1', (select jsonb_build_object('title', title, 'status', status, 'note', note, 'under_tate', reports_to = s_tate, 'empty', member_id is null) from public.org_positions where id = s_open));
  x := public.org_fill(s_open, (select member_id from public.org_positions where id = s_karan));
  res := res || jsonb_build_object('f1', x, 'f1_karan_role', (select role from public.team_members m join public.org_positions p on p.member_id = m.id where p.id = s_open),
    'f1_old_seat', (select jsonb_build_object('empty', member_id is null, 'status', status, 'note', note) from public.org_positions where id = s_karan));
  begin perform public.org_remove(s_open); res := res || jsonb_build_object('rm_filled', 'ALLOWED'); exception when others then res := res || jsonb_build_object('rm_filled', sqlerrm); end;
  x := public.org_remove(s_karan);
  res := res || jsonb_build_object('rm_empty', x, 'rm_gone', not exists (select 1 from public.org_positions where id = s_karan));
  x := public.org_vacate(s_mary);
  res := res || jsonb_build_object('v1', (select jsonb_build_object('empty', member_id is null, 'note', note) from public.org_positions where id = s_mary));
  x := public.org_place((select id from public.team_members where name = 'Mary'), s_ahmed);
  res := res || jsonb_build_object('p1', (select jsonb_build_object('under_ahmed', reports_to = s_ahmed, 'title', title) from public.org_positions where id = (x->>'id')::bigint));
  x := public.org_update(s_ian, 'Director of Marketing and Communications');
  res := res || jsonb_build_object('u1_role', (select role from public.team_members where name = 'Ian'), 'u1_title', (select title from public.org_positions where id = s_ian));

  -- the roster keeps up
  insert into public.team_members (name, department, role, active) values ('ZZ New Person', 'marketing', 'Photographer', true) returning id into m_new;
  select id into s_new from public.org_positions where member_id = m_new;
  res := res || jsonb_build_object('t1_seat', (select jsonb_build_object('title', title, 'under_ian', reports_to = s_ian) from public.org_positions where id = s_new));
  update public.team_members set role = 'Photographer and video' where id = m_new;
  res := res || jsonb_build_object('t2_title', (select title from public.org_positions where id = s_new));
  update public.team_members set active = false where id = m_new;
  res := res || jsonb_build_object('t3_left', (select jsonb_build_object('empty', member_id is null, 'status', status, 'note', note) from public.org_positions where id = s_new));

  -- someone who is not an editor
  perform set_config('request.jwt.claims', '{"email":"samson.jules@welfareavenue.com","role":"authenticated"}', true);
  begin perform public.org_move(s_joy, s_ian); res := res || jsonb_build_object('n1_member', 'ALLOWED'); exception when others then res := res || jsonb_build_object('n1_member', sqlerrm); end;
  begin
    execute 'set local role authenticated';
    select count(*) into n from public.org_positions;
    res := res || jsonb_build_object('n2_member_reads', n);
    begin update public.org_positions set title = 'x' where id = s_joy; get diagnostics n = row_count; res := res || jsonb_build_object('n3_direct_write', n); exception when others then res := res || jsonb_build_object('n3_direct_write', sqlerrm); end;
    execute 'reset role';
  exception when others then res := res || jsonb_build_object('n_error', sqlerrm); execute 'reset role';
  end;
  begin
    execute 'set local role anon';
    select count(*) into n from public.org_positions;
    res := res || jsonb_build_object('n4_anon_reads', n);
    execute 'reset role';
  exception when others then res := res || jsonb_build_object('n4_anon', sqlerrm); execute 'reset role';
  end;
  raise exception 'WA133 TEST RESULT %', res::text;
end $t$;
