-- wave220 (09/10/26), applied as migration wa220_backfill_new_hires: the two people who joined since the CRM import
-- (Alyx, hired from Applications on 25/09; Roberto, added 02/10) get their one record now: Alyx's phone and personal
-- email from her application, a volunteer record for both (Roberto was joined to his existing volunteer record).
do $$
begin
  perform set_config('request.jwt.claims', '{"email":"steel.macdonald@welfareavenue.com","role":"authenticated"}', true);
  perform public.wa220_member_contact(50, true);
  perform public.wa220_member_contact(52, true);
end $$;
