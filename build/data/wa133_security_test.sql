-- dry run of wa133_security.sql: applies it, checks it, and rolls everything back with the TEST RESULT exception
do $t$
declare
  v_task bigint; v_admin text; v_id1 bigint; v_id2 bigint; v_stamp text; n int; r text := '';
begin
  -- the migration, inside this transaction
  execute 'alter view public.wa_brand_assets_list set (security_invoker = true)';
  execute 'revoke insert, update, delete, truncate, trigger, references on public.wa_brand_assets_list from anon, authenticated';
  execute 'alter table public.task_files add column if not exists by_email text';
  execute $fn$create or replace function public.task_files_stamp()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'authenticated' then
    new.by_email := lower(nullif(auth.jwt() ->> 'email', ''));
  end if;
  return new;
end $$
$fn$;
  execute 'revoke all on function public.task_files_stamp() from public, anon, authenticated';
  execute 'drop trigger if exists task_files_stamp on public.task_files';
  execute 'create trigger task_files_stamp before insert on public.task_files for each row execute function public.task_files_stamp()';
  execute 'drop policy if exists task_files_delete on public.task_files';
  execute $p$create policy task_files_delete on public.task_files for delete to authenticated using (
  public.is_hub_admin()
  or lower(coalesce(by_email, '')) = lower(coalesce(auth.jwt() ->> 'email', '-'))
  or lower(coalesce(by, '')) = lower(coalesce(auth.jwt() ->> 'email', '-'))
)$p$;

  select id into v_task from public.dept_tasks order by id limit 1;
  select email into v_admin from public.hub_roles where role = 'admin' order by email limit 1;

  -- A adds two attachments, the first one claiming to be someone else
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'email', 'test.a@welfareavenue.com', 'user_metadata', json_build_object('full_name', 'Test Person A'))::text, true);
  set local role authenticated;
  insert into public.task_files (task_id, name, path, kind, by, by_email) values (v_task, 'w133 test a1', null, 'link', 'Test Person A', 'someone.else@welfareavenue.com') returning id, by_email into v_id1, v_stamp;
  insert into public.task_files (task_id, name, path, kind, by) values (v_task, 'w133 test a2', null, 'link', 'Test Person A') returning id into v_id2;
  r := r || ' stamp=' || coalesce(v_stamp, 'null');
  update public.task_files set by_email = 'x@welfareavenue.com' where id = v_id1; get diagnostics n = row_count; r := r || ' a_rewrite=' || n;
  reset role;

  -- B gives their own account A's name and tries to delete A's attachment
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'email', 'test.b@welfareavenue.com', 'user_metadata', json_build_object('full_name', 'Test Person A'))::text, true);
  set local role authenticated;
  delete from public.task_files where id = v_id1; get diagnostics n = row_count; r := r || ' b_delete=' || n;
  select count(*) into n from public.task_files where id in (v_id1, v_id2); r := r || ' b_sees=' || n;
  reset role;

  -- A removes their own
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'email', 'test.a@welfareavenue.com')::text, true);
  set local role authenticated;
  delete from public.task_files where id = v_id2; get diagnostics n = row_count; r := r || ' a_delete_own=' || n;
  reset role;

  -- an admin removes anyone's
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'email', v_admin)::text, true);
  set local role authenticated;
  delete from public.task_files where id = v_id1; get diagnostics n = row_count; r := r || ' admin_delete=' || n;
  update public.wa_brand_assets set note = note; get diagnostics n = row_count; r := r || ' admin_brand_write=' || n;
  reset role;

  -- the brand view: a signed-in outsider can read but not write; anonymous visitors can read
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'email', 'outsider@example.com')::text, true);
  set local role authenticated;
  begin
    update public.wa_brand_assets_list set note = note; get diagnostics n = row_count; r := r || ' outsider_view_write=' || n;
  exception when others then r := r || ' outsider_view_write=refused(' || sqlstate || ')';
  end;
  select count(*) into n from public.wa_brand_assets_list; r := r || ' outsider_reads=' || n;
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  select count(*) into n from public.wa_brand_assets_list; r := r || ' anon_reads=' || n;
  reset role;

  raise exception 'TEST RESULT%', r;
end $t$;
