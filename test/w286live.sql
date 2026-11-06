-- wave286: assertions on the live database, after build/data/wa281_rules.sql (and the other slice files), test/w286live_before.sql and
-- build/data/wa286_vm_chapter.sql (run twice). Runs only inside the block build/sql_rollback_test.py prints, so everything rolls back (the Toronto
-- serving and the roster row it makes for the trigger check included). No transaction control. Raises on the first failure, with the check's name
-- and counts only; personal data never leaves the database. It never runs wa266f_email_drain (that would call mail-send over http, which a rollback
-- cannot take back): the drain's text and its route expression are checked instead. The admin and the volunteer used are picked inside the database.

do $live$
declare
  s record; f record; d text; n bigint; n_all bigint; n_mtl bigint; n_to bigint; n_both bigint; v_admin text; v_pool jsonb; m jsonb;
  v_ev bigint; v_ev2 bigint; v_contact bigint; v_vol bigint; v_roster bigint; v_route text;
begin
  select * into s from pg_temp.w286_state_before;
  select * into f from pg_temp.w286_fn_before;
  select email into v_admin from public.hub_roles where role = 'admin' and email <> '' order by email limit 1;

  -- the servings: every one Montreal, none added or removed, and the list every Montreal page reads is the list of before, row for row
  if (select count(*) from public.volunteer_events) <> s.servings then raise exception 'w286live: the number of servings moved'; end if;
  if exists (select 1 from public.volunteer_events where chapter <> 'montreal') then raise exception 'w286live: a serving is not Montreal'; end if;
  select count(*) into n from (select j from pg_temp.w286_view_before except all select to_jsonb(v) - 'chapter' from public.volunteer_event_summary v) x;
  if n <> 0 then raise exception 'w286live: % serving rows of before are missing or changed in volunteer_event_summary', n; end if;
  select count(*) into n from (select to_jsonb(v) - 'chapter' from public.volunteer_event_summary v where v.chapter = 'montreal' except all select j from pg_temp.w286_view_before) x;
  if n <> 0 then raise exception 'w286live: the Montreal list has % rows it did not have before', n; end if;
  if (select count(*) from public.volunteer_event_summary where chapter = 'montreal') <> (select count(*) from pg_temp.w286_view_before) then
    raise exception 'w286live: the Montreal list is not the list of before, row for row';
  end if;
  if (select count(*) from public.event_roster) <> s.roster or (select count(*) from public.crm_contacts) <> s.contacts or (select count(*) from public.crm_contact_chapters) <> s.chapter_rows then
    raise exception 'w286live: a roster, contact or chapter count moved';
  end if;

  -- the view: security invoker, read only for signed-in users, its comment
  if (select reloptions::text from pg_class where oid = 'public.volunteer_event_summary'::regclass) is distinct from f.view_opts then raise exception 'w286live: the view is not security invoker as before'; end if;
  if (select relacl::text from pg_class where oid = 'public.volunteer_event_summary'::regclass) not like '%authenticated=r/%' then raise exception 'w286live: signed-in users do not read the view (or still write it)'; end if;
  if obj_description('public.volunteer_event_summary'::regclass, 'pg_class') not like f.view_cmt || ' wave286 adds chapter%' then raise exception 'w286live: the view comment'; end if;

  -- Find volunteers: one version, four arguments, its grants and comment; all chapters finds the same people as before (less do-not-contact people)
  if to_regprocedure('public.wa191_recruit_pool(bigint[],integer,integer)') is not null or (select count(*) from pg_proc where proname = 'wa191_recruit_pool') <> 1 then
    raise exception 'w286live: wa191_recruit_pool is not one four-argument function';
  end if;
  if (select proacl::text from pg_proc where oid = 'public.wa191_recruit_pool(bigint[],integer,integer,text)'::regprocedure) is distinct from f.pool_acl then raise exception 'w286live: wa191_recruit_pool grants changed'; end if;
  if obj_description('public.wa191_recruit_pool(bigint[],integer,integer,text)'::regprocedure, 'pg_proc') not like f.pool_cmt || ' wave286: %' then raise exception 'w286live: wa191_recruit_pool comment'; end if;
  perform set_config('request.jwt.claims', json_build_object('email', v_admin, 'role', 'authenticated')::text, true);
  v_pool := public.wa191_recruit_pool(null::bigint[], 60, 3, null) - 'today' - 'window_open';
  select count(*) into n from (
    (select x from jsonb_array_elements((select b.j -> 'people' from pg_temp.w286_pool_before b)) x
      where (x ->> 'c')::bigint not in (select id from public.crm_contacts where do_not_contact)
     except all select x from jsonb_array_elements(v_pool -> 'people') x)
    union all
    (select x from jsonb_array_elements(v_pool -> 'people') x
     except all select x from jsonb_array_elements((select b.j -> 'people' from pg_temp.w286_pool_before b)) x)) y;
  if n <> 0 then raise exception 'w286live: Find volunteers for all chapters differs from before for % people', n; end if;
  if (v_pool - 'people') is distinct from ((select b.j from pg_temp.w286_pool_before b) - 'people') then raise exception 'w286live: Find volunteers answers differently around the people'; end if;
  n_all := jsonb_array_length(v_pool -> 'people');
  n_mtl := jsonb_array_length(public.wa191_recruit_pool(p_chapter => 'montreal') -> 'people');
  n_to := jsonb_array_length(public.wa191_recruit_pool(p_chapter => 'toronto') -> 'people');
  select count(*) into n_both from jsonb_array_elements(v_pool -> 'people') x
   where exists (select 1 from public.crm_contact_chapters c where c.contact_id = (x ->> 'c')::bigint and c.chapter = 'montreal')
     and exists (select 1 from public.crm_contact_chapters c where c.contact_id = (x ->> 'c')::bigint and c.chapter = 'toronto');
  if n_mtl + n_to - n_both <> n_all or n_to = 0 or n_mtl = 0 then
    raise exception 'w286live: Montreal (%) and Toronto (%) less both (%) do not make all chapters (%)', n_mtl, n_to, n_both, n_all;
  end if;

  -- the chapter map: staff get every volunteer with a chapter row; anyone else gets {}
  m := public.wa286_volunteer_chapters();
  select count(distinct c.volunteer_id) into n from public.crm_contacts c where c.volunteer_id is not null and c.merged_into is null and exists (select 1 from public.crm_contact_chapters cc where cc.contact_id = c.id);
  if (select count(*) from jsonb_object_keys(m)) <> n then raise exception 'w286live: the chapter map has % volunteers, expected %', (select count(*) from jsonb_object_keys(m)), n; end if;
  perform set_config('request.jwt.claims', '', true);
  if public.wa286_volunteer_chapters() <> '{}'::jsonb then raise exception 'w286live: the chapter map answers someone not signed in'; end if;
  if (select proacl::text from pg_proc where oid = 'public.wa286_volunteer_chapters()'::regprocedure) like '%anon=%' then raise exception 'w286live: anon can run wa286_volunteer_chapters'; end if;

  -- the trigger: a volunteer confirmed on a Toronto serving joins Toronto (a serving made Toronto and a roster row, both rolled back)
  select c.id, c.volunteer_id into v_contact, v_vol from public.crm_contacts c
   where c.volunteer_id is not null and c.merged_into is null and not exists (select 1 from public.crm_contact_chapters x where x.contact_id = c.id and x.chapter = 'toronto')
   order by c.id limit 1;
  select e.id into v_ev from public.volunteer_events e order by e.event_date desc, e.id desc limit 1;
  select e.id into v_ev2 from public.volunteer_events e where e.id <> v_ev order by e.event_date desc, e.id desc limit 1;
  if v_contact is null or v_ev is null or v_ev2 is null then raise exception 'w286live: no volunteer or serving to try the trigger with'; end if;
  update public.volunteer_events set chapter = 'toronto' where id = v_ev;
  insert into public.event_roster (event_id, person_id, person_name, role, status) values (v_ev, v_vol, 'wave286 live check', 'server', 'Confirmed') returning id into v_roster;
  if not exists (select 1 from public.crm_contact_chapters where contact_id = v_contact and chapter = 'toronto' and source = 'serving') then
    raise exception 'w286live: a volunteer confirmed on a Toronto serving did not join Toronto';
  end if;

  -- the drain: the route once, at the top level, its grants; the route expression gives toronto for that serving and volunteer for a Montreal one
  d := pg_get_functiondef('public.wa266f_email_drain(integer)'::regprocedure);
  if (length(d) - length(replace(d, $x$'route', (select c.mail_route from public.crm_chapters c$x$, ''))) / length($x$'route', (select c.mail_route from public.crm_chapters c$x$) <> 1 then
    raise exception 'w286live: the drain does not name the route exactly once';
  end if;
  if position($x$'reply_to', public.wa258_role_owner(r.role), 'route', (select c.mail_route$x$ in d) = 0 then raise exception 'w286live: the route is not next to reply_to'; end if;
  if (select proacl::text from pg_proc where oid = 'public.wa266f_email_drain(integer)'::regprocedure) is distinct from f.drain_acl then raise exception 'w286live: the drain grants changed'; end if;
  select c.mail_route into v_route from public.crm_chapters c join public.volunteer_events ve on ve.chapter = c.code where ve.id = (select x.event_id from public.event_roster x where x.id = v_roster);
  if v_route is distinct from 'toronto' then raise exception 'w286live: the route for a Toronto serving is %', coalesce(v_route, 'none'); end if;
  select r.id into v_roster from public.event_roster r where r.event_id = v_ev2 limit 1;
  if v_roster is not null then
    select c.mail_route into v_route from public.crm_chapters c join public.volunteer_events ve on ve.chapter = c.code where ve.id = (select x.event_id from public.event_roster x where x.id = v_roster);
    if v_route is distinct from 'volunteer' then raise exception 'w286live: the route for a Montreal serving is %', coalesce(v_route, 'none'); end if;
  end if;
  if (select (m2.value::jsonb -> 'routes' ->> 'toronto') from public.app_config m2 where m2.key = 'mail_senders') is distinct from 'toronto@welfareavenue.com' then
    raise exception 'w286live: mail_senders has no toronto route';
  end if;

  if (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave286' and field = 'wave286') <> 1 then raise exception 'w286live: not one release line'; end if;
end $live$;
