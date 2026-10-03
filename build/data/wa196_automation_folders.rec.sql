-- wave196 (02/10/26): the CRM's automations in folders and in your own order (Steel: "reshape how the automation page is
-- to make it easier to move round automations in the CRM").
alter table public.crm_automations add column if not exists folder text;
alter table public.crm_automations add column if not exists sort_order integer;
comment on column public.crm_automations.folder is 'wave196: the folder it sits in on the Automations page (null: no folder)';
comment on column public.crm_automations.sort_order is 'wave196: its place in the list (smallest first; null after the numbered ones, oldest first)';
-- the order they have today
update public.crm_automations a set sort_order = x.n from (select id, (row_number() over (order by created_at, id))::int * 10 as n from public.crm_automations) x where x.id = a.id and a.sort_order is null;
-- one call moves many: [{id, folder, sort}], with the caller's own row security (staff on the CRM)
create or replace function public.crm_automations_arrange(p_items jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
  if not public.is_wa_staff() then raise exception 'The CRM is for the Welfare Avenue team.'; end if;
  update public.crm_automations a
     set sort_order = x.sort, folder = nullif(btrim(x.folder), '')
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as x(id bigint, folder text, sort integer)
   where a.id = x.id and (a.sort_order is distinct from x.sort or a.folder is distinct from nullif(btrim(x.folder), ''));
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.crm_automations_arrange(jsonb) from public, anon;
grant execute on function public.crm_automations_arrange(jsonb) to authenticated;

-- the record
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261002120000', 'wa196_automation_folders', array[$m$alter table public.crm_automations add column if not exists folder text$m$,$m$alter table public.crm_automations add column if not exists sort_order integer$m$,$m$comment on column public.crm_automations.folder is 'wave196: the folder it sits in on the Automations page (null: no folder)'$m$,$m$comment on column public.crm_automations.sort_order is 'wave196: its place in the list (smallest first; null after the numbered ones, oldest first)'$m$,$m$update public.crm_automations a set sort_order = x.n from (select id, (row_number() over (order by created_at, id))::int * 10 as n from public.crm_automations) x where x.id = a.id and a.sort_order is null$m$,$m$create or replace function public.crm_automations_arrange(p_items jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
  if not public.is_wa_staff() then raise exception 'The CRM is for the Welfare Avenue team.'; end if;
  update public.crm_automations a
     set sort_order = x.sort, folder = nullif(btrim(x.folder), '')
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as x(id bigint, folder text, sort integer)
   where a.id = x.id and (a.sort_order is distinct from x.sort or a.folder is distinct from nullif(btrim(x.folder), ''));
  get diagnostics n = row_count;
  return n;
end $$$m$,$m$revoke execute on function public.crm_automations_arrange(jsonb) from public, anon$m$,$m$grant execute on function public.crm_automations_arrange(jsonb) to authenticated$m$]) on conflict (version) do update set name = excluded.name, statements = excluded.statements;
