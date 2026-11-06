-- wave282: assertions on the live database, after build/data/wa281_rules.sql, test/w282live_before.sql and build/data/wa282_mail_rule.sql (run
-- twice). Runs only inside the block build/sql_rollback_test.py prints, so everything rolls back (the two lists it builds included). No transaction
-- control. Raises on the first failure, with the check's name and counts only; personal data never leaves the database. The staff members used for
-- the signed-in checks are picked inside the database (an admin, and a member outside marketing and fundraising) and never printed.

do $live$
declare
  rule text := 'not unsubscribed (WA rule of 5 Nov 2026)';
  n bigint; v_allowed bigint; v_addr bigint; v_first bigint; v_first_addr bigint; v_admin text; v_other text; v_err text; r jsonb; m bigint[]; f bigint[]; s record; d text;
begin
  select * into s from pg_temp.w282_state_before;
  select email into v_admin from public.hub_roles where role = 'admin' and email <> '' order by email limit 1;
  select email into v_other from public.hub_roles where role in ('member', 'leader') and coalesce(profile, '') not in ('marketing', 'fundraising') and email <> '' order by email limit 1;
  if v_admin is null then raise exception 'w282live: no admin to sign in as'; end if;

  -- crm_email_permission: patched once, the exemption block gone, the grants kept
  d := pg_get_functiondef('public.crm_email_permission(bigint,text)'::regprocedure);
  if (length(d) - length(replace(d, 'WA rule of 5 Nov 2026', ''))) / length('WA rule of 5 Nov 2026') <> 1 then raise exception 'w282live: crm_email_permission is not patched exactly once'; end if;
  if position('mail_fundraising_exemption' in d) > 0 then raise exception 'w282live: the exemption block is still in crm_email_permission'; end if;
  if (select proacl::text from pg_proc where oid = 'public.crm_email_permission(bigint,text)'::regprocedure) is distinct from (select acl from pg_temp.w282_fn_before) then
    raise exception 'w282live: crm_email_permission grants changed';
  end if;

  -- every contact: transactional and volunteer unchanged; newsletter and fundraising unchanged where allowed before, and where refused for a reason
  -- other than consent; refused for no consent (none recorded, or implied consent ran out) before, allowed now with the new basis
  select count(*) into n from pg_temp.w282_perm_before b cross join lateral public.crm_email_permission(b.id, b.kind) p
   where b.kind in ('transactional', 'volunteer') and (p.allowed is distinct from b.allowed or p.basis is distinct from b.basis);
  if n <> 0 then raise exception 'w282live: transactional or volunteer permission changed for % contact-kinds', n; end if;
  select count(*) into n from pg_temp.w282_perm_before b cross join lateral public.crm_email_permission(b.id, b.kind) p
   where b.kind in ('newsletter', 'fundraising')
     and case when b.allowed or not (b.basis = 'no consent recorded' or b.basis like 'implied consent ran out on %')
              then p.allowed is distinct from b.allowed or p.basis is distinct from b.basis
              else not (p.allowed and p.basis = rule) end;
  if n <> 0 then raise exception 'w282live: newsletter or fundraising permission changed wrongly for % contact-kinds', n; end if;
  select count(*) into n from pg_temp.w282_perm_before b where b.kind = 'newsletter' and not b.allowed and (b.basis = 'no consent recorded' or b.basis like 'implied consent ran out on %');
  if n = 0 then raise exception 'w282live: nobody gained a newsletter under the new rule'; end if;

  -- the setting, the kind check, the column comment
  if exists (select 1 from public.app_config where key = 'mail_fundraising_exemption') then raise exception 'w282live: mail_fundraising_exemption is still there'; end if;
  if (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.crm_campaigns'::regclass and conname = 'crm_campaigns_kind_check')
     is distinct from 'CHECK ((kind = ANY (ARRAY[''newsletter''::text, ''fundraising''::text, ''volunteer''::text])))' then raise exception 'w282live: the kind check is not the three kinds'; end if;
  begin
    insert into public.crm_campaigns (name, kind) values ('W282 rollback check (transactional)', 'transactional');
    v_err := 'no error';
  exception when check_violation then v_err := 'check';
  end;
  if v_err <> 'check' then raise exception 'w282live: a transactional Send was accepted'; end if;
  if col_description('public.crm_campaigns'::regclass, (select attnum from pg_attribute where attrelid = 'public.crm_campaigns'::regclass and attname = 'kind')) not like '%Since wave282%' then
    raise exception 'w282live: the crm_campaigns.kind comment is not the wave282 one';
  end if;

  -- first contact: null for nobody signed in; as an admin, exactly the direct rule
  perform set_config('request.jwt.claims', '', true);
  if public.crm_email_first_contact((select min(id) from public.crm_contacts where merged_into is null)) is not null then raise exception 'w282live: crm_email_first_contact answers the service role'; end if;
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'email', v_admin)::text, true);
  select count(*) into v_first from public.crm_contacts c where c.merged_into is null and public.crm_email_first_contact(c.id);
  select count(*) into n
    from public.crm_contacts c cross join lateral public.crm_email_permission(c.id, 'newsletter') p
   where c.merged_into is null and p.allowed and p.basis = rule
     and not exists (select 1 from public.crm_email_sends x where x.contact_id = c.id and not x.is_test and (x.status in ('sent', 'delivered') or x.opened_at is not null or x.clicked_at is not null))
     and not coalesce(c.legacy_refs -> 'keela' -> 'email_marketing' ->> 'last_opened' ~ '^\d{4}-\d{2}-\d{2}$'
                      and c.legacy_refs -> 'keela' -> 'email_marketing' ->> 'last_opened' >= to_char(current_date - interval '12 months', 'YYYY-MM-DD'), false);
  if n <> v_first then raise exception 'w282live: crm_email_first_contact gives % first contacts, the direct rule %', v_first, n; end if;

  -- the two lists, as an admin: one record per address (lower-cased, trimmed) in each, no address on both, and together every allowed address
  select count(*), count(distinct lower(btrim(p.email))) into v_allowed, v_addr
    from public.crm_contacts c cross join lateral public.crm_email_permission(c.id, 'newsletter') p where c.merged_into is null and p.allowed;
  with a as (select c.id, lower(btrim(p.email)) as addr, public.crm_email_first_contact(c.id) as first
               from public.crm_contacts c cross join lateral public.crm_email_permission(c.id, 'newsletter') p where c.merged_into is null and p.allowed)
  select count(distinct a.addr) into v_first_addr from a where a.first and not exists (select 1 from a b where b.addr = a.addr and not b.first);
  r := public.wa282_newsletter_lists('W282 rollback check');
  if (r ->> 'main')::bigint + (r ->> 'first_contacts')::bigint <> v_addr then raise exception 'w282live: the lists hold % + %, the allowed addresses are %', r ->> 'main', r ->> 'first_contacts', v_addr; end if;
  if (r ->> 'first_contacts')::bigint <> v_first_addr then raise exception 'w282live: the first-contacts list holds %, the direct count is %', r ->> 'first_contacts', v_first_addr; end if;
  if (r ->> 'left_out_same_address')::bigint <> v_allowed - v_addr then raise exception 'w282live: left_out_same_address is %, expected %', r ->> 'left_out_same_address', v_allowed - v_addr; end if;
  select member_ids into m from public.crm_lists where id = (r ->> 'main_list_id')::bigint and kind = 'static' and name = 'W282 rollback check: main';
  select member_ids into f from public.crm_lists where id = (r ->> 'first_contacts_list_id')::bigint and kind = 'static' and name = 'W282 rollback check: first contacts';
  if cardinality(m) <> (r ->> 'main')::bigint or cardinality(f) <> (r ->> 'first_contacts')::bigint then raise exception 'w282live: the lists do not hold the counts returned'; end if;
  if m && f then raise exception 'w282live: someone is on both lists'; end if;
  if exists (select 1 from unnest(f) x where not public.crm_email_first_contact(x)) then raise exception 'w282live: the first-contacts list holds someone who is not a first contact'; end if;
  if (select count(*) <> count(distinct lower(btrim(p.email))) from unnest(m) x cross join lateral public.crm_email_permission(x, 'newsletter') p)
     or (select count(*) <> count(distinct lower(btrim(p.email))) from unnest(f) x cross join lateral public.crm_email_permission(x, 'newsletter') p) then
    raise exception 'w282live: an address appears twice in one list';
  end if;
  if exists (select 1 from unnest(m) x cross join lateral public.crm_email_permission(x, 'newsletter') pm
               join (select lower(btrim(p.email)) as addr from unnest(f) y cross join lateral public.crm_email_permission(y, 'newsletter') p) q on q.addr = lower(btrim(pm.email))) then
    raise exception 'w282live: an address is on both lists';
  end if;
  if (select count(distinct lower(btrim(p.email))) from unnest(m || f) x cross join lateral public.crm_email_permission(x, 'newsletter') p) <> v_addr then
    raise exception 'w282live: the lists do not reach every allowed address';
  end if;
  if exists (select 1 from unnest(m || f) x join public.crm_contacts c on c.id = x where c.merged_into is not null or coalesce(c.email_status, '') in ('unsubscribed', 'bounced', 'complained') or c.do_not_contact) then
    raise exception 'w282live: a list holds someone who may not be emailed';
  end if;

  -- refused: nobody signed in, and a staff member outside marketing and fundraising
  perform set_config('request.jwt.claims', '', true);
  begin
    perform public.wa282_newsletter_lists('W282 rollback check refused');
    v_err := 'no error';
  exception when others then v_err := sqlerrm;
  end;
  if v_err not like 'not allowed%' then raise exception 'w282live: wa282_newsletter_lists did not refuse the service role'; end if;
  if v_other is not null then
    perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'email', v_other)::text, true);
    begin
      perform public.wa282_newsletter_lists('W282 rollback check refused');
      v_err := 'no error';
    exception when others then v_err := sqlerrm;
    end;
    if v_err not like 'not allowed%' then raise exception 'w282live: wa282_newsletter_lists did not refuse a staff member outside marketing and fundraising'; end if;
  end if;
  perform set_config('request.jwt.claims', '', true);

  -- grants
  if has_function_privilege('anon', 'public.crm_email_first_contact(bigint)', 'execute') or has_function_privilege('anon', 'public.wa282_newsletter_lists(text)', 'execute') then
    raise exception 'w282live: anon can run a new function';
  end if;
  if not (has_function_privilege('authenticated', 'public.crm_email_first_contact(bigint)', 'execute') and has_function_privilege('service_role', 'public.crm_email_first_contact(bigint)', 'execute')
          and has_function_privilege('authenticated', 'public.wa282_newsletter_lists(text)', 'execute') and has_function_privilege('service_role', 'public.wa282_newsletter_lists(text)', 'execute')) then
    raise exception 'w282live: the new functions are not granted to signed-in users and the service role';
  end if;

  -- nothing else moved
  if (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave282' and field = 'wave282') <> 1 then raise exception 'w282live: not one release line'; end if;
  if (select count(*) from public.crm_contacts) <> s.contacts or (select count(*) from public.crm_email_sends) <> s.deliveries or (select count(*) from public.crm_campaigns) <> s.sends
     or (select count(*) from public.crm_lists) <> s.lists + 2 then raise exception 'w282live: a contact, delivery, Send or list count moved'; end if;
end $live$;
