-- wa157c_problems_grant (28/09/26): the automation check is for signed-in staff; the two text helpers are not for anon.
revoke execute on function public.crm_automation_problems(jsonb, jsonb) from public, anon;
grant execute on function public.crm_automation_problems(jsonb, jsonb) to authenticated;
revoke execute on function public.crm_fill(text, jsonb) from anon;
revoke execute on function public.crm_text_html(text) from anon;
