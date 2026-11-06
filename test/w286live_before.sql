-- wave286: the live state just before the migration (after wave281), kept in temp tables for test/w286live.sql and test/w286live_undo.sql.
-- Runs only inside the block build/sql_rollback_test.py prints, after build/data/wa281_rules.sql (and the other slice files) and before
-- build/data/wa286_vm_chapter.sql, so everything rolls back. No transaction control. Reads only. Personal data stays in the database: the later files
-- compare inside it and raise only counts and names of checks. The admin used for the signed-in reads is picked inside the database and never printed.

create temp table w286_fn_before as
  select md5(pg_get_functiondef('public.wa266f_email_drain(integer)'::regprocedure)) as drain_md5,
         obj_description('public.wa266f_email_drain(integer)'::regprocedure, 'pg_proc') as drain_cmt,
         (select proacl::text from pg_proc where oid = 'public.wa266f_email_drain(integer)'::regprocedure) as drain_acl,
         md5(pg_get_functiondef('public.wa191_recruit_pool(bigint[],integer,integer)'::regprocedure)) as pool_md5,
         obj_description('public.wa191_recruit_pool(bigint[],integer,integer)'::regprocedure, 'pg_proc') as pool_cmt,
         (select proacl::text from pg_proc where oid = 'public.wa191_recruit_pool(bigint[],integer,integer)'::regprocedure) as pool_acl,
         md5(pg_get_viewdef('public.volunteer_event_summary'::regclass, true)) as view_md5,
         obj_description('public.volunteer_event_summary'::regclass, 'pg_class') as view_cmt,
         (select relacl::text from pg_class where oid = 'public.volunteer_event_summary'::regclass) as view_acl,
         (select reloptions::text from pg_class where oid = 'public.volunteer_event_summary'::regclass) as view_opts;

-- every serving as the Servings and Calendar lists read them today (volunteer_event_summary), row for row
create temp table w286_view_before as select to_jsonb(v) as j from public.volunteer_event_summary v;

create temp table w286_state_before as
  select (select count(*) from public.volunteer_events) as servings,
         (select count(*) from public.event_roster) as roster,
         (select count(*) from public.crm_contact_chapters) as chapter_rows,
         (select count(*) from public.crm_contacts) as contacts;

-- Find volunteers today, as an admin (three arguments, no servings chosen); the clock-dependent keys are left out
create temp table w286_pool_before (j jsonb);
do $before$
declare v_admin text;
begin
  if to_regclass('public.crm_chapters') is null then raise exception 'w286live_before: wave281 has not run first'; end if;
  if to_regprocedure('public.wa191_recruit_pool(bigint[],integer,integer,text)') is not null then raise exception 'w286live_before: wave286 has run already'; end if;
  select email into v_admin from public.hub_roles where role = 'admin' and email <> '' order by email limit 1;
  if v_admin is null then raise exception 'w286live_before: no admin to sign in as'; end if;
  perform set_config('request.jwt.claims', json_build_object('email', v_admin, 'role', 'authenticated')::text, true);
  insert into pg_temp.w286_pool_before select public.wa191_recruit_pool(null::bigint[], 60, 3) - 'today' - 'window_open';
  perform set_config('request.jwt.claims', '', true);
  if jsonb_array_length((select j -> 'people' from pg_temp.w286_pool_before)) = 0 then raise exception 'w286live_before: Find volunteers found nobody'; end if;
end $before$;
