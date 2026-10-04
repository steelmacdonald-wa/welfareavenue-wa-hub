-- wave205 dry run: run after wa205_strategy.sql and wa205_strategy_data.sql in ONE transaction; it always ends in an
-- exception that carries the results, so nothing is kept. Simulated sign-ins: request.jwt.claims + role authenticated.
do $t$
declare r jsonb := '{}'::jsonb; g1 bigint; g2 bigint; g3 bigint; x jsonb; n int; v text; hid bigint; mid bigint; e text;
begin
  select id into g1 from public.goals where number = 1 and retired_at is null;
  select id into g2 from public.goals where number = 2 and retired_at is null;
  select id into g3 from public.goals where number = 3 and retired_at is null;
  r := r || jsonb_build_object(
    'org_active', (select count(*) from public.goals where department = 'org' and retired_at is null),
    'org_numbered', (select string_agg(number || ':' || title, ' | ' order by number) from public.goals where number is not null),
    'milestones', (select count(*) from public.goal_milestones), 'paths', (select count(*) from public.goal_paths),
    'owners', (select string_agg(g.number || '=' || m.name || case when o.is_lead then '*' else '' end, ', ' order by g.number, o.sort) from public.goal_owners o join public.goals g on g.id = o.goal_id join public.team_members m on m.id = o.member_id),
    'docs', (select count(*) from public.strategy_docs), 'plan_keys', (select count(*) from public.strategy_plan),
    'retired', (select count(*) from public.goals where retired_at is not null),
    'retired_status_archived', (select count(*) from public.goals where retired_at is not null and status = 'archived'),
    'wins_kept', (select count(*) from public.goal_wins w join public.goals g on g.id = w.goal_id where g.retired_at is not null),
    'history_after_seed', (select count(*) from public.goal_history),
    'projects_on_new_goals', (select count(*) from public.projects p join public.goals g on g.id = p.goal_id where g.number is not null),
    'projects_with_milestone', (select count(*) from public.projects where milestone_id is not null),
    'owner_text', (select string_agg(owner, ' / ' order by number) from public.goals where number is not null),
    'cron_active', (select active from cron.job where jobid = 6));

  -- Shima (leader; owner of goals 1, 2, 5)
  perform set_config('request.jwt.claims', '{"email":"shima.butera@welfareavenue.com","role":"authenticated"}', true);
  perform set_config('role', 'authenticated', true);
  select why into v from public.goals where id = g1;
  x := public.strategy_save('goal', g1, 'why', v || ' (test)', v); r := r || jsonb_build_object('shima_save_g1', x->'ok');
  x := public.strategy_save('goal', g1, 'why', 'stale edit', v); r := r || jsonb_build_object('shima_stale_conflict', x->'conflict', 'conflict_by', x->'by');
  begin x := public.strategy_save('goal', g3, 'why', 'x', (select why from public.goals where id = g3)); r := r || jsonb_build_object('shima_g3', 'SAVED (wrong)'); exception when others then r := r || jsonb_build_object('shima_g3_refused', sqlerrm); end;
  update public.goals set why = 'direct write' where id = g3; get diagnostics n = row_count; r := r || jsonb_build_object('shima_direct_g3_rows', n);
  x := public.strategy_add('milestone', g1, 'FY28', 'Test milestone'); mid := (x->>'id')::bigint; r := r || jsonb_build_object('shima_add_ms', mid is not null);
  x := public.strategy_save('milestone', mid, 'status', 'in progress', 'not started'); r := r || jsonb_build_object('shima_ms_status', x->'ok');
  x := public.strategy_remove('milestone', mid); r := r || jsonb_build_object('shima_ms_remove', x->'ok');
  select id into hid from public.goal_history where entity = 'milestone' and entity_id = mid and field = 'archived_at' order by id desc limit 1;
  x := public.strategy_restore(hid); r := r || jsonb_build_object('shima_restore_ms', x->'ok', 'ms_back', (select archived_at is null from public.goal_milestones where id = mid));
  select id into hid from public.goal_history where entity = 'goal' and entity_id = g1 and field = 'why' order by id desc limit 1;
  x := public.strategy_restore(hid); r := r || jsonb_build_object('shima_restore_why', x->'ok', 'why_back', (select why = v from public.goals where id = g1));
  x := public.strategy_owner_set(g1, 17, true, false, null); r := r || jsonb_build_object('shima_add_owner', x->'ok');
  x := public.strategy_owner_set(g1, 17, false, null, null); r := r || jsonb_build_object('shima_remove_owner', x->'ok');
  r := r || jsonb_build_object('history_rows_g1', (select string_agg(entity || '.' || field || ' by ' || coalesce(changed_by_name, '?'), '; ' order by id) from public.goal_history where goal_id = g1));
  begin x := public.strategy_set_approval('approved'); r := r || jsonb_build_object('shima_approve', 'APPROVED (wrong)'); exception when others then r := r || jsonb_build_object('shima_approve_refused', sqlerrm); end;
  begin x := public.strategy_doc_save(null, '{"title":"x"}'); r := r || jsonb_build_object('shima_doc', 'SAVED (wrong)'); exception when others then r := r || jsonb_build_object('shima_doc_refused', sqlerrm); end;
  execute 'reset role';

  -- Samson (member, HR): reads, comments, links a project; cannot edit a goal
  perform set_config('request.jwt.claims', '{"email":"samson.jules@welfareavenue.com","role":"authenticated"}', true);
  perform set_config('role', 'authenticated', true);
  begin x := public.strategy_save('goal', g2, 'title', 'x', (select title from public.goals where id = g2)); r := r || jsonb_build_object('member_save', 'SAVED (wrong)'); exception when others then r := r || jsonb_build_object('member_save_refused', sqlerrm); end;
  update public.goals set title = 'direct' where id = g2; get diagnostics n = row_count; r := r || jsonb_build_object('member_direct_rows', n);
  begin update public.goal_milestones set body = 'direct' where goal_id = g2; r := r || jsonb_build_object('member_direct_ms', 'WROTE (wrong)'); exception when others then r := r || jsonb_build_object('member_direct_ms_refused', left(sqlerrm, 60)); end;
  x := public.strategy_comment_add(g2, null, null, 'A comment from a member (dry run)'); r := r || jsonb_build_object('member_comment', x->>'id' is not null);
  x := public.strategy_comment_add(g2, null, (x->>'id')::bigint, 'A reply (dry run)'); r := r || jsonb_build_object('member_reply_parent', x->'parent_id' is not null);
  x := public.strategy_link_project(16, g1, null); r := r || jsonb_build_object('member_link', x->'ok');
  r := r || jsonb_build_object('member_reads_ms', (select count(*) from public.goal_milestones), 'member_reads_hist', (select count(*) > 0 from public.goal_history));
  begin insert into public.goals (department, title) values ('org', 'sneaky'); r := r || jsonb_build_object('member_insert_goal', 'INSERTED (wrong)'); exception when others then r := r || jsonb_build_object('member_insert_goal_refused', left(sqlerrm, 80)); end;
  execute 'reset role';

  -- Kellian (viewer, board profile, a welfareavenue.com account): reads only
  perform set_config('request.jwt.claims', '{"email":"kellian.debargis@welfareavenue.com","role":"authenticated"}', true);
  perform set_config('role', 'authenticated', true);
  r := r || jsonb_build_object('viewer_reads_goals', (select count(*) from public.goals where number is not null));
  begin x := public.strategy_comment_add(g1, null, null, 'viewer'); r := r || jsonb_build_object('viewer_comment', 'SAVED (wrong)'); exception when others then r := r || jsonb_build_object('viewer_comment_refused', sqlerrm); end;
  begin insert into public.goal_comments (goal_id, body, author) values (g1, 'direct', 'Kellian'); r := r || jsonb_build_object('viewer_direct_comment', 'INSERTED (wrong)'); exception when others then r := r || jsonb_build_object('viewer_direct_comment_refused', left(sqlerrm, 80)); end;
  update public.goals set title = 'v' where id = g1; get diagnostics n = row_count; r := r || jsonb_build_object('viewer_direct_rows', n);
  begin x := public.strategy_link_project(16, g2, null); r := r || jsonb_build_object('viewer_link', 'LINKED (wrong)'); exception when others then r := r || jsonb_build_object('viewer_link_refused', sqlerrm); end;
  execute 'reset role';

  -- Tamara (a board viewer, board_viewers, gmail): reads only
  perform set_config('request.jwt.claims', '{"email":"consult.tamaraangeline@gmail.com","role":"authenticated"}', true);
  perform set_config('role', 'authenticated', true);
  r := r || jsonb_build_object('board_reads_goals', (select count(*) from public.goals where number is not null), 'board_reads_ms', (select count(*) from public.goal_milestones), 'board_reads_docs', (select count(*) from public.strategy_docs), 'board_reads_owners', (select count(*) from public.goal_owners), 'board_reads_comments', (select count(*) from public.goal_comments where goal_id = g2));
  begin x := public.strategy_comment_add(g1, null, null, 'board'); r := r || jsonb_build_object('board_comment', 'SAVED (wrong)'); exception when others then r := r || jsonb_build_object('board_comment_refused', sqlerrm); end;
  update public.goals set title = 'b' where id = g1; get diagnostics n = row_count; r := r || jsonb_build_object('board_direct_rows', n);
  execute 'reset role';

  -- anon: nothing
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  begin perform count(*) from public.goal_milestones; r := r || jsonb_build_object('anon_ms', 'READ (wrong)'); exception when others then r := r || jsonb_build_object('anon_ms_refused', left(sqlerrm, 60)); end;
  begin x := public.strategy_save('goal', g1, 'why', 'x', ''); r := r || jsonb_build_object('anon_save', 'SAVED (wrong)'); exception when others then r := r || jsonb_build_object('anon_save_refused', left(sqlerrm, 60)); end;
  execute 'reset role';

  -- Steel (admin): approval, the library, a retired goal into a project, Ian (admin) edits any goal
  perform set_config('request.jwt.claims', '{"email":"steel.macdonald@welfareavenue.com","role":"authenticated"}', true);
  perform set_config('role', 'authenticated', true);
  x := public.strategy_set_approval('approved'); r := r || jsonb_build_object('admin_approve', x->'goals');
  x := public.strategy_set_approval('draft'); r := r || jsonb_build_object('admin_back_to_draft', x->'goals');
  x := public.strategy_doc_save((select min(id) from public.strategy_docs), '{"pinned": false}'); r := r || jsonb_build_object('admin_unpin', x->'pinned');
  x := public.strategy_retired_to_project(25); r := r || jsonb_build_object('admin_to_project', x->'project_id', 'goal25_moved', (select moved_to_project_id is not null from public.goals where id = 25));
  begin x := public.strategy_retired_to_project(25); r := r || jsonb_build_object('admin_to_project_twice', 'TWICE (wrong)'); exception when others then r := r || jsonb_build_object('admin_to_project_twice_refused', sqlerrm); end;
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"email":"ian.odhiambo@welfareavenue.com","role":"authenticated"}', true);
  perform set_config('role', 'authenticated', true);
  x := public.strategy_save('goal', g2, 'baseline', 'Not tracked yet', (select baseline from public.goals where id = g2)); r := r || jsonb_build_object('ian_admin_saves_g2', x->'ok');
  execute 'reset role';

  raise exception 'WA205DRYRUN %', r::text;
end $t$;
