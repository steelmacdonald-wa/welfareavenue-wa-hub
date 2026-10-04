-- wave205c (04/10/26): the history trigger and its two helpers are internal (the trigger and the checked functions call
-- them as owner); the security advisor listed them as callable by signed-in users through the default privileges.
revoke all on function public.wa205_hist(), public.wa205_who(), public.wa205_name(text) from public, anon, authenticated;
