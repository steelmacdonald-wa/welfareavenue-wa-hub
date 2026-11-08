-- Welfare Avenue Hub: wave295 undo checks. Run on live ONLY inside build/sql_rollback_test.py's block, after build/data/wa295_undo.sql; proved
-- offline first by node test/w295sql.mjs. No transaction control. Reads definitions only.
do $$
begin
  assert md5(pg_get_functiondef('public.crm_contact_match(public.crm_contacts_v,jsonb)'::regprocedure)) = 'd21db1e35fb6e0a8f65d766db3a1d618',
    'undo: crm_contact_match is back exactly as live had it on 07/11/26';
  assert md5(obj_description('public.crm_contact_match(public.crm_contacts_v,jsonb)'::regprocedure, 'pg_proc')) = '3d41cf5110030a3322bb951dffea4217',
    'undo: its comment is back';
  assert (select proacl::text from pg_proc where oid = 'public.crm_contact_match(public.crm_contacts_v,jsonb)'::regprocedure) = '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}',
    'undo: its grants are back';
  assert md5(pg_get_functiondef('public.crm_list_preview(jsonb)'::regprocedure)) = '8088527269cf3f6b75105421ee453abf', 'undo: crm_list_preview is back exactly';
  assert md5(obj_description('public.crm_list_preview(jsonb)'::regprocedure, 'pg_proc')) = 'f51932b9bf2a0fc879a2f91ae2b9ce52', 'undo: its comment is back';
  assert to_regprocedure('public.crm_filter_contacts(jsonb)') is null and to_regprocedure('public.crm_filter_prepare(jsonb)') is null and to_regprocedure('public.crm_filter_prepare_tag(jsonb)') is null,
    'undo: crm_filter_contacts, crm_filter_prepare and crm_filter_prepare_tag are gone';
  assert not has_function_privilege('service_role', 'public.crm_tag_aliases()', 'execute'), 'undo: the service role no longer reads crm_tag_aliases';
  assert (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave295' and field = 'wave295 undo') = 1, 'undo: one undo line';
end $$;
select 'w295live_undo: all checks passed' as result;
