-- =====================================================================
-- wave243b (15/10/26): the execute grants on this week's functions, set right
-- =====================================================================
-- PostgreSQL grants EXECUTE on a new function to PUBLIC, so "revoke ... from anon, authenticated" alone changes nothing:
-- the roles keep the right through PUBLIC (the security advisor listed every wa239 to wa242 function as executable by
-- anon). The rule from now on: revoke from public, anon and authenticated, then grant back exactly what the Hub calls.
-- - internal (called inside security definer functions or by cron only): nobody
-- - the Hub's own calls (signed-in staff; the function checks the caller itself): authenticated
-- - the /c/ page (a token in the link): anon and authenticated
-- =====================================================================
revoke execute on function public.wa239_photo_owner() from public, anon, authenticated;
revoke execute on function public.wa239_pool_text(bigint, boolean) from public, anon, authenticated;
revoke execute on function public.wa241_approvers() from public, anon, authenticated;
revoke execute on function public.wa242_due_lists(bigint) from public, anon, authenticated;
revoke execute on function public.wa242_due_reminders(boolean) from public, anon, authenticated;
revoke execute on function public.wa242_name_is(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.wa239_pool_list() from public, anon;
grant execute on function public.wa239_pool_list() to authenticated;
revoke execute on function public.wa239_pool_send(text, bigint[]) from public, anon;
grant execute on function public.wa239_pool_send(text, bigint[]) to authenticated;
revoke execute on function public.wa240_event_content_set(bigint, jsonb) from public, anon;
grant execute on function public.wa240_event_content_set(bigint, jsonb) to authenticated;
revoke execute on function public.wa242_due_mine() from public, anon;
grant execute on function public.wa242_due_mine() to authenticated;
revoke execute on function public.wa242_prefs_set(jsonb) from public, anon;
grant execute on function public.wa242_prefs_set(jsonb) to authenticated;
revoke execute on function public.wa242_remind_me() from public, anon;
grant execute on function public.wa242_remind_me() to authenticated;
revoke execute on function public.wa239_pool_get(text) from public;
grant execute on function public.wa239_pool_get(text) to anon, authenticated;
revoke execute on function public.wa239_pool_answer(text, jsonb) from public;
grant execute on function public.wa239_pool_answer(text, jsonb) to anon, authenticated;
