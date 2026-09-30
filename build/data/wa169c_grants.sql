-- wa169c_grants (30/09/26): the security advisor's rule for new functions (not executable by anon). wa169_can_assign is
-- used by academy_assignments' read policy and by wave169's functions, for signed-in people only; onboarding_template_propagate
-- runs as the template's trigger and is never called directly.
revoke all on function public.wa169_can_assign() from public, anon;
grant execute on function public.wa169_can_assign() to authenticated;
revoke all on function public.onboarding_template_propagate() from public, anon, authenticated;
