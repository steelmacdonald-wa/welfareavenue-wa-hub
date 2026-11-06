-- wave282: checks on the live database after build/data/wa282_mail_rule.sql and then build/data/wa282_undo.sql (run twice). Runs only inside the
-- block build/sql_rollback_test.py prints, after build/data/wa281_rules.sql and test/w282live_before.sql, so everything rolls back. No transaction
-- control. It proves the undo puts back what wave281 leaves: crm_email_permission exactly (definition md5, comment, grants) and every contact's answer
-- for every kind, the old kind check and its comment, the setting off, and the two new functions gone. Raises on the first failure, with names and
-- counts only.

do $undo$
declare n bigint; s record; f record;
begin
  select * into f from pg_temp.w282_fn_before;
  if md5(pg_get_functiondef('public.crm_email_permission(bigint,text)'::regprocedure)) <> f.def_md5 then raise exception 'w282live_undo: crm_email_permission is not back as it was'; end if;
  if obj_description('public.crm_email_permission(bigint,text)'::regprocedure, 'pg_proc') is distinct from f.cmt then raise exception 'w282live_undo: the crm_email_permission comment is not back'; end if;
  if (select proacl::text from pg_proc where oid = 'public.crm_email_permission(bigint,text)'::regprocedure) is distinct from f.acl then raise exception 'w282live_undo: the crm_email_permission grants are not back'; end if;
  select count(*) into n from pg_temp.w282_perm_before b cross join lateral public.crm_email_permission(b.id, b.kind) p
   where p.allowed is distinct from b.allowed or p.basis is distinct from b.basis;
  if n <> 0 then raise exception 'w282live_undo: crm_email_permission answers differently for % contact-kinds', n; end if;

  select * into s from pg_temp.w282_state_before;
  if (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.crm_campaigns'::regclass and conname = 'crm_campaigns_kind_check') is distinct from s.kind_check then
    raise exception 'w282live_undo: the kind check is not back as it was';
  end if;
  if col_description('public.crm_campaigns'::regclass, (select attnum from pg_attribute where attrelid = 'public.crm_campaigns'::regclass and attname = 'kind')) is distinct from s.kind_cmt then
    raise exception 'w282live_undo: the crm_campaigns.kind comment is not back';
  end if;
  if (select value from public.app_config where key = 'mail_fundraising_exemption') is distinct from s.setting then raise exception 'w282live_undo: mail_fundraising_exemption is not back as it was'; end if;
  if to_regprocedure('public.crm_email_first_contact(bigint)') is not null or to_regprocedure('public.wa282_newsletter_lists(text)') is not null then raise exception 'w282live_undo: a wave282 function is left'; end if;
  if (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave282' and field = 'wave282 undo') <> 1 then raise exception 'w282live_undo: not one undo line'; end if;
  if (select count(*) from public.crm_contacts) <> s.contacts or (select count(*) from public.crm_campaigns) <> s.sends or (select count(*) from public.crm_lists) <> s.lists then
    raise exception 'w282live_undo: a contact, Send or list count moved';
  end if;
end $undo$;
