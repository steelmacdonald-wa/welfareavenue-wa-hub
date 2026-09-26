-- wave133 security follow-up: the two ERROR findings from the Supabase security advisor (found during the wave133 release review)

-- 1. wa_brand_assets_list ran with its owner's rights (a SECURITY DEFINER view) and kept the default write grants,
--    so any signed-in account could change the brand assets through it (the table itself only lets admins write).
--    Reading stays the same (the brand assets are readable by everyone); writing goes through the table's own rules.
alter view public.wa_brand_assets_list set (security_invoker = true);
revoke insert, update, delete, truncate, trigger, references on public.wa_brand_assets_list from anon, authenticated;

-- 2. task_files_delete trusted user_metadata.full_name, which anyone can edit on their own account.
--    Each attachment now records the verified email of whoever added it, and that is what the delete rule checks.
alter table public.task_files add column if not exists by_email text;

create or replace function public.task_files_stamp()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  -- a signed-in person is always recorded as themselves (whatever the request says)
  if coalesce(auth.jwt() ->> 'role', '') = 'authenticated' then
    new.by_email := lower(nullif(auth.jwt() ->> 'email', ''));
  end if;
  return new;
end $$;
revoke all on function public.task_files_stamp() from public, anon, authenticated;

drop trigger if exists task_files_stamp on public.task_files;
create trigger task_files_stamp before insert on public.task_files for each row execute function public.task_files_stamp();

drop policy if exists task_files_delete on public.task_files;
create policy task_files_delete on public.task_files for delete to authenticated using (
  public.is_hub_admin()
  or lower(coalesce(by_email, '')) = lower(coalesce(auth.jwt() ->> 'email', '-'))
  or lower(coalesce(by, '')) = lower(coalesce(auth.jwt() ->> 'email', '-'))
);
