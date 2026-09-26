-- wa132 dry run: run after wa132_bank.sql in ONE transaction; it always ends in an exception, so nothing stays.
do $t$
declare
  res jsonb := '{}'::jsonb;
  v_today date := public.wa_today();
  p1 bigint; s1 bigint; s2 bigint; pr bigint; sp bigint; pt1 bigint; pt2 bigint; pst bigint; bt bigint; ai1 bigint; ai2 bigint; ai3 bigint; txid bigint; nt bigint;
  x jsonb; n int;
begin
  perform set_config('request.jwt.claims', '{"email":"steel.macdonald@welfareavenue.com","role":"authenticated"}', true);
  res := res || jsonb_build_object('can_bank', public.wa_can_bank(), 'actor', public.wa_actor_name(), 'today', v_today);

  -- a task with two subtasks
  insert into public.dept_tasks (department, title, owner, status, done, due_date, sort) values ('marketing', 'ZZ bank test parent', 'Steel', 'Open', false, v_today + 10, 1) returning id into p1;
  insert into public.dept_tasks (department, title, owner, status, done, parent_task_id, due_date, sort) values ('marketing', 'ZZ sub 1', 'Steel', 'Open', false, p1, v_today + 12, 1) returning id into s1;
  insert into public.dept_tasks (department, title, owner, status, done, parent_task_id, sort) values ('marketing', 'ZZ sub 2', 'Steel', 'Open', false, p1, 2) returning id into s2;
  x := public.bank_task(p1, v_today + 100, 'After the gala');
  select count(*) into n from public.dept_tasks where id in (p1, s1, s2) and banked_at is not null and due_date is null and bank_until = v_today + 100;
  res := res || jsonb_build_object('t1_bank_task', x, 't1_banked_rows', n, 't1_bank_due', (select bank_due from public.dept_tasks where id = p1));
  begin
    execute 'set local role authenticated';
    select count(*) into n from public.dept_tasks where id in (p1, s1, s2);
    x := public.bank_list();
    execute 'reset role';
    res := res || jsonb_build_object('t2_visible_to_app', n,
      't2_list_parent', (select count(*) from jsonb_array_elements(x->'tasks') e where (e->>'id')::bigint = p1 and (e->>'subtasks')::int = 2),
      't2_list_subs', (select count(*) from jsonb_array_elements(x->'tasks') e where (e->>'id')::bigint in (s1, s2)));
  exception when others then res := res || jsonb_build_object('t2_error', sqlerrm); execute 'reset role';
  end;
  x := public.bank_redate('task', p1, v_today + 120);
  select count(*) into n from public.dept_tasks where id in (p1, s1, s2) and bank_until = v_today + 120;
  res := res || jsonb_build_object('t3_redate_rows', n);
  x := public.bank_unbank('task', p1, 'test');
  select count(*) into n from public.dept_tasks where id in (p1, s1, s2) and banked_at is null and resurfaced_at is not null;
  res := res || jsonb_build_object('t4_unbank', x, 't4_back_rows', n,
    't4_due_back', (select jsonb_agg(due_date order by id) from public.dept_tasks where id in (p1, s1, s2)));
  x := public.bank_list();
  res := res || jsonb_build_object('t5_back_parent', (select count(*) from jsonb_array_elements(x->'back') e where (e->>'id')::bigint = p1 and e->>'kind' = 'task'),
    't5_back_subs', (select count(*) from jsonb_array_elements(x->'back') e where (e->>'id')::bigint in (s1, s2)));
  -- a subtask banked on its own, then closed: it leaves the bank as done
  x := public.bank_task(s2, v_today + 50, null);
  update public.dept_tasks set done = true where id = s2;
  res := res || jsonb_build_object('t6_closed_banked', (select jsonb_build_object('done', done, 'banked_at', banked_at, 'closed', closed_at is not null) from public.dept_tasks where id = s2));
  -- a date in the past is refused
  begin perform public.bank_task(p1, v_today, null); res := res || jsonb_build_object('t7_past', 'ALLOWED');
  exception when others then res := res || jsonb_build_object('t7_past', sqlerrm); end;

  -- a project with a sub-project, tasks in both, and a subtask with no project
  insert into public.projects (department, name, status, leads, sort) values ('marketing', 'ZZ Bank Project', 'active', '["Steel"]'::jsonb, 99) returning id into pr;
  insert into public.projects (department, name, status, parent_id, sort) values ('marketing', 'ZZ Sub Project', 'active', pr, 99) returning id into sp;
  insert into public.dept_tasks (department, title, owner, status, done, project_id, due_date, sort) values ('marketing', 'ZZ proj task', 'Steel', 'Open', false, pr, v_today + 3, 1) returning id into pt1;
  insert into public.dept_tasks (department, title, owner, status, done, project_id, sort) values ('marketing', 'ZZ sub-project task', 'Steel', 'Open', false, sp, 1) returning id into pt2;
  insert into public.dept_tasks (department, title, owner, status, done, parent_task_id, sort) values ('marketing', 'ZZ proj subtask', 'Steel', 'Open', false, pt1, 1) returning id into pst;
  x := public.bank_project(pr, v_today + 90, 'Next season');
  res := res || jsonb_build_object('p1_bank_project', x,
    'p1_projects', (select count(*) from public.projects where id in (pr, sp) and banked_at is not null),
    'p1_tasks', (select count(*) from public.dept_tasks where id in (pt1, pt2, pst) and banked_at is not null and bank_project_id = pr));
  x := public.bank_list();
  res := res || jsonb_build_object('p2_list_project', (select jsonb_agg(jsonb_build_object('sub', e->'subprojects', 'tasks', e->'tasks', 'titles', e->'task_titles', 'lead', e->'lead')) from jsonb_array_elements(x->'projects') e where (e->>'id')::bigint = pr),
    'p2_list_sub', (select count(*) from jsonb_array_elements(x->'projects') e where (e->>'id')::bigint = sp),
    'p2_list_ptasks', (select count(*) from jsonb_array_elements(x->'tasks') e where (e->>'id')::bigint in (pt1, pt2, pst)));
  begin perform public.bank_project(19, v_today + 90, null); res := res || jsonb_build_object('p3_general', 'ALLOWED');
  exception when others then res := res || jsonb_build_object('p3_general', sqlerrm); end;
  -- the daily job brings the project back with everything in it
  update public.projects set bank_until = v_today where id in (pr, sp);
  update public.dept_tasks set bank_until = v_today where bank_project_id = pr;
  x := public.bank_resurface();
  res := res || jsonb_build_object('p4_resurface', x,
    'p4_projects_back', (select count(*) from public.projects where id in (pr, sp) and banked_at is null and resurfaced_at is not null),
    'p4_tasks_back', (select count(*) from public.dept_tasks where id in (pt1, pt2, pst) and banked_at is null and bank_project_id is null),
    'p4_due', (select due_date from public.dept_tasks where id = pt1));
  x := public.bank_list();
  res := res || jsonb_build_object('p5_back', (select jsonb_agg(jsonb_build_object('k', e->>'kind', 'id', e->>'id')) from jsonb_array_elements(x->'back') e where (e->>'id')::bigint in (pr, sp, pt1, pt2, pst)));
  -- a task banked alone inside a project that is later banked does not come back before the project
  x := public.bank_task(pt2, v_today + 30, 'own date');
  x := public.bank_project(pr, v_today + 200, 'again');
  update public.dept_tasks set bank_until = v_today where id = pt2;
  x := public.bank_resurface();
  res := res || jsonb_build_object('p6_pushed', (select jsonb_build_object('banked', banked_at is not null, 'until', bank_until) from public.dept_tasks where id = pt2));

  -- straight into the bank
  x := public.bank_add_task('marketing', 'ZZ straight to the bank', v_today + 150, 'Spring', null, 'Steel');
  nt := (x->>'id')::bigint;
  res := res || jsonb_build_object('a1_add', (select jsonb_build_object('banked', banked_at is not null, 'until', bank_until, 'note', bank_note, 'owner', owner) from public.dept_tasks where id = nt));

  -- the board's list leaves banked tasks out
  insert into public.dept_tasks (department, title, owner, status, done, sort) values ('board', 'ZZ board banked', 'Steel', 'Open', false, 1) returning id into bt;
  x := public.bank_task(bt, v_today + 60, null);
  x := public.board_home();
  res := res || jsonb_build_object('b1_board_home_has_banked', (select count(*) from jsonb_array_elements(coalesce(x->'tasks', '[]'::jsonb)) e where (e->>'id')::bigint = bt), 'b1_board_home_null', x is null);

  -- the AI path: a meeting that puts work off
  select id into txid from public.transcripts where department ilike '%marketing%' order by id desc limit 1;
  x := public.apply_transcript_result(txid, jsonb_build_object('summary', 'ZZ test', 'new_tasks', jsonb_build_array(
      jsonb_build_object('title', 'ZZ AI banked', 'owner', 'Steel', 'description', 'd', 'priority', false, 'flag', false, 'bank_until', (v_today + 100)::text, 'bank_reason', 'After the March gala', 'due_date', (v_today + 110)::text),
      jsonb_build_object('title', 'ZZ AI too soon', 'owner', 'Steel', 'description', 'd', 'priority', false, 'flag', false, 'bank_until', (v_today + 20)::text),
      jsonb_build_object('title', 'ZZ AI normal', 'owner', 'Steel', 'description', 'd', 'priority', false, 'flag', false, 'due_date', (v_today + 5)::text, 'project_id', pr::text))), 'AI: ZZ test');
  select id into ai1 from public.dept_tasks where title = 'ZZ AI banked' order by id desc limit 1;
  select id into ai2 from public.dept_tasks where title = 'ZZ AI too soon' order by id desc limit 1;
  select id into ai3 from public.dept_tasks where title = 'ZZ AI normal' order by id desc limit 1;
  res := res || jsonb_build_object('ai_result', x,
    'ai_banked', (select jsonb_build_object('banked', banked_at is not null, 'until', bank_until, 'note', bank_note, 'due', due_date, 'bank_due', bank_due) from public.dept_tasks where id = ai1),
    'ai_too_soon', (select banked_at is null from public.dept_tasks where id = ai2),
    'ai_banked_project_not_used', (select project_id is null from public.dept_tasks where id = ai3));
  n := public.bank_unbank_do('task', ai1, 'the meeting started it again', 'AI: ZZ test');
  res := res || jsonb_build_object('ai_unbank', n, 'ai_back_due', (select due_date from public.dept_tasks where id = ai1));

  -- a board viewer cannot bank
  perform set_config('request.jwt.claims', '{"email":"zz.nobody@example.com","role":"authenticated"}', true);
  begin perform public.bank_task(p1, v_today + 100, null); res := res || jsonb_build_object('v1_outsider', 'ALLOWED');
  exception when others then res := res || jsonb_build_object('v1_outsider', sqlerrm); end;
  res := res || jsonb_build_object('v1_list_outsider', public.bank_list()->'tasks');

  raise exception 'WA132 TEST RESULT %', res::text;
end $t$;
