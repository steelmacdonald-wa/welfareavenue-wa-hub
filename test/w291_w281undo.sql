-- wave291 test only: wave281's undo for wa171_opted_out, copied unchanged from build/data/wa281_undo.sql on branch crm-slice1-280-284 (at b489858,
-- unchanged at 79a1de8): today's live text of the function with its grants and comment. It puts today's text back after test/w291_w281text.sql.
-- The stopped-phones view and the keyword indexes stay (nothing reads them once the text is back): dropping an index takes a lock that stops
-- every reader of quo_messages until the block ends, and the check does not need it. Never a migration: it only runs inside a block that rolls back.

CREATE OR REPLACE FUNCTION public.wa171_opted_out(p_person bigint, p_phone text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.crm_contacts c where c.sms_opt_out and c.merged_into is null
                 and (c.volunteer_id = p_person or exists (select 1 from unnest(c.phones) ph where public.wa171_digits(ph) = public.wa171_digits(p_phone))));
$function$
;
revoke all on function public.wa171_opted_out(bigint, text) from public, anon, authenticated;
grant execute on function public.wa171_opted_out(bigint, text) to service_role;
  comment on function public.wa171_opted_out(bigint, text) is 'wave171: true when the volunteer (or anyone with that number) replied STOP or was marked no texts in the CRM (crm_contacts.sms_opt_out).';
