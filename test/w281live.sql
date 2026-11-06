-- wave281: assertions on the live database, after build/data/wa281_rules.sql. Runs only inside the block build/sql_rollback_test.py prints, after
-- test/w281live_before.sql and the migration, so everything rolls back. No transaction control. Raises on the first failure, with the check's name and
-- counts only; personal data never leaves the database. Invented rows only (Test ..., example.invalid). The staff member used for the signed-in checks is
-- picked inside the database (an admin, and a member who is not one) and never printed.

do $live$
declare e record; n bigint; v_keep bigint; v_drop bigint; v_admin text; v_member text; r record; k text; c_gbd bigint; g bigint; v_moved bigint[];
begin
  select * into e from pg_temp.w281_expect;
  select email into v_admin from public.hub_roles where role = 'admin' order by email limit 1;
  select email into v_member from public.hub_roles where role = 'member' order by email limit 1;
  if v_admin is null or v_member is null then raise exception 'w281live: no admin or member to sign in as'; end if;

  -- chapters
  select count(*) into n from public.crm_contact_chapters where chapter = 'toronto';
  if n <> e.toronto then raise exception 'w281live: % toronto rows, expected %', n, e.toronto; end if;
  select count(*) into n from public.crm_contact_chapters where chapter = 'montreal';
  if n <> e.montreal then raise exception 'w281live: % montreal rows, expected %', n, e.montreal; end if;
  if exists (select 1 from public.crm_contact_chapters where source <> 'evidence' or added_by <> 'wave281') then raise exception 'w281live: a chapter row that is not from the backfill'; end if;
  if (select count(*) from public.crm_chapters) <> 2 then raise exception 'w281live: crm_chapters does not have two rows'; end if;
  if not exists (select 1 from public.app_config where key = 'mail_senders' and (value::jsonb -> 'routes') ? 'toronto') then raise exception 'w281live: mail_senders has no toronto route'; end if;

  -- the consent log: the two backfills, and nothing else
  select count(*) into n from public.crm_consent_events where column_name = 'form consent' and actor = 'wave281 backfill';
  if n <> e.form_consent then raise exception 'w281live: % form consent rows, expected %', n, e.form_consent; end if;
  select count(*) into n from public.crm_consent_events where source = 'change_log';
  if n <> e.change_log_rows then raise exception 'w281live: % change_log rows, expected %', n, e.change_log_rows; end if;
  select count(*) into n from public.crm_consent_events;
  if n <> e.form_consent + e.change_log_rows then raise exception 'w281live: % consent rows in all, expected %', n, e.form_consent + e.change_log_rows; end if;

  -- Campaigns, gift and form links
  if (select count(*) from public.wa_campaigns) <> 7 then raise exception 'w281live: wa_campaigns does not have seven rows'; end if;
  if (select string_agg(name || '=' || status, ',' order by id) from public.wa_campaigns where status = 'done') <> 'Football Fundraiser 2025=done,Holiday Gift Baskets=done' then raise exception 'w281live: the done campaigns are wrong'; end if;
  select count(*) into n from public.crm_donations where campaign_id is not null;
  if n <> e.gifts then raise exception 'w281live: % gifts linked, expected %', n, e.gifts; end if;
  select id into c_gbd from public.wa_campaigns where donate_key = 'gift-basket-drive';
  select count(*) into n from public.crm_forms where (settings ->> 'campaign_id')::bigint = c_gbd;
  if n <> e.forms then raise exception 'w281live: % drive forms linked, expected %', n, e.forms; end if;
  if public.crm_gift_campaign_id('Holiday Gift Basket Drive 2026') is distinct from c_gbd or public.crm_gift_campaign_id('fundraising campaign') is not null then
    raise exception 'w281live: crm_gift_campaign_id maps wrongly';
  end if;
  if (select count(*) from public.crm_fields where created_by = 'wave281') <> 4 then raise exception 'w281live: not four new fields'; end if;
  if (select count(*) from public.crm_donations) <> e.donations or (select count(*) from public.crm_contacts) <> e.contacts then raise exception 'w281live: a gift or contact count moved'; end if;

  -- nobody's email permission changed (nobody is do-not-contact yet)
  select count(*) into n from pg_temp.w281_perm_before b cross join lateral public.crm_email_permission(b.id, b.kind) p
   where p.allowed is distinct from b.allowed or p.basis is distinct from b.basis;
  if n <> 0 then raise exception 'w281live: crm_email_permission changed for % contact-kinds', n; end if;
  -- texting: the only change is that stopped phones (sms) are now opted out
  select count(*) into n from pg_temp.w281_opt_before b
   where public.wa171_opted_out(null, b.phone) is distinct from (b.opted_out or exists (select 1 from public.wa_stopped_phones_v s where s.channel = 'sms' and s.phone_digits = public.wa171_digits(b.phone)));
  if n <> 0 then raise exception 'w281live: wa171_opted_out changed for % phones beyond the stopped ones', n; end if;
  select count(*) into n from pg_temp.w281_vol_before b where public.wa171_opted_out(b.volunteer_id, null) is distinct from b.opted_out;
  if n <> 0 then raise exception 'w281live: wa171_opted_out changed for % volunteers', n; end if;
  select count(*) into n from public.wa_stopped_phones_v s where s.channel = 'sms' and not public.wa171_opted_out(null, s.phone_digits);
  if n <> 0 then raise exception 'w281live: % stopped phones are still textable', n; end if;
  -- the contacts view: the same rows and values, plus three columns at their defaults
  select md5(string_agg((to_jsonb(v) - 'job_title' - 'do_not_contact' - 'dnc_reason')::text, '|' order by v.id)), count(*) into k, n from public.crm_contacts_v v;
  if k is distinct from (select m from pg_temp.w281_view_rows_before) then raise exception 'w281live: crm_contacts_v rows changed (% rows)', n; end if;
  if exists (select 1 from public.crm_contacts_v where do_not_contact or job_title is not null or dnc_reason is not null) then raise exception 'w281live: the new view columns are not at their defaults'; end if;

  -- patched once each: every marker appears exactly as often as the patch put it in
  select count(*) into n
    from (values ('public.crm_email_permission(bigint,text)', $m$'do not contact'::text$m$, 1), ('public.wa171_opted_out(bigint,text)', 'wa_stopped_phones_v', 1),
                 ('public.wa171_inbound(jsonb)', 'wa.consent_source', 2), ('public.wa254_inbound(jsonb)', 'WhatsApp STOP', 1),
                 ('public.crm_refresh_implied_consent()', 'daily implied-consent refresh', 1), ('public.crm_merge_contacts(bigint,bigint)', '-- wave281:', 1),
                 ('public.wa_app_config_guard()', 'keela', 1)) x(f, marker, times)
   where (length(pg_get_functiondef(x.f::regprocedure)) - length(replace(pg_get_functiondef(x.f::regprocedure), x.marker, ''))) / length(x.marker) <> x.times;
  if n <> 0 then raise exception 'w281live: % functions are not patched exactly once', n; end if;
  if (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave281' and field = 'wave281') <> 1 then raise exception 'w281live: not one release line'; end if;
  if (select chk from pg_temp.w281_policy_before) like '%caps%' or not exists (select 1 from pg_policy where polname = 'hub_roles_self_member' and pg_get_expr(polwithcheck, polrelid) like '%caps = ''{}''::jsonb%') then
    raise exception 'w281live: hub_roles_self_member does not require empty caps';
  end if;

  -- grants and row security
  if exists (select 1 from unnest(array['public.crm_add_chapter(bigint,text,text,text)', 'public.crm_in_chapter(bigint,text)', 'public.crm_consent_log()', 'public.crm_consent_guard()',
               'public.crm_set_do_not_contact(bigint,text)', 'public.crm_age_band(bigint)', 'public.wa_can(text)', 'public.wa_my_caps()', 'public.crm_gift_campaign_id(text)',
               'public.wa281_gift_campaign()']) f where has_function_privilege('anon', f, 'execute')) then raise exception 'w281live: anon can run a new function'; end if;
  if has_function_privilege('authenticated', 'public.crm_add_chapter(bigint,text,text,text)', 'execute') or has_function_privilege('authenticated', 'public.crm_gift_campaign_id(text)', 'execute')
     or has_table_privilege('authenticated', 'public.wa_stopped_phones_v', 'select') then raise exception 'w281live: a service-role-only object is open to signed-in users'; end if;
  if exists (select 1 from pg_class where relname in ('crm_chapters', 'crm_contact_chapters', 'crm_consent_events', 'crm_contact_private', 'wa_campaigns', 'wa_campaign_people')
               and relnamespace = 'public'::regnamespace and (not relrowsecurity or has_table_privilege('anon', oid, 'select'))) then raise exception 'w281live: a new table lacks row security or is open to anon'; end if;

  -- the keela_ settings: a signed-in member who is not an admin is refused
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'email', v_member)::text, true);
  begin
    update public.app_config set value = value where key like 'keela\_%';
    raise exception 'w281live: a member changed a keela_ setting';
  exception when raise_exception then
    if sqlerrm like 'w281live:%' then raise; end if;
  end;
  if public.wa_can('import_admin') then raise exception 'w281live: a member passes import_admin'; end if;

  perform set_config('request.jwt.claims', '', true);
  if public.wa_can('import_admin') then raise exception 'w281live: nobody signed in passes import_admin'; end if;

  -- an admin: capabilities, do-not-contact, merge, age band and a new drive gift, on invented contacts only
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'email', v_admin, 'sub', '00000000-0000-0000-0000-000000000281')::text, true);
  if not (public.wa_can('import_admin') and public.wa_can('gifts_edit') and public.wa_can('hr_private')) or public.wa_can('no_such_thing') then raise exception 'w281live: an admin''s capabilities are wrong'; end if;

  insert into public.crm_contacts (full_name, emails, email_status, source) values ('Test W281 Live Keep', array['w281.live.keep@example.invalid'], 'subscribed', 'manual') returning id into v_keep;
  insert into public.crm_contacts (full_name, emails, email_status, job_title, source) values ('Test W281 Live Drop', array['w281.live.drop@example.invalid'], 'subscribed', 'Chef', 'manual') returning id into v_drop;
  if (select count(*) from public.crm_consent_events where contact_id in (v_keep, v_drop)) <> 2 or exists (select 1 from public.crm_consent_events where contact_id in (v_keep, v_drop) and source <> 'staff') then
    raise exception 'w281live: creating two subscribed contacts as staff did not write one staff row each';
  end if;
  perform public.crm_set_do_not_contact(v_drop, 'asked');
  perform set_config('wa.consent_source', '', true);
  select * into r from public.crm_contacts where id = v_drop;
  if not (r.do_not_contact and r.dnc_reason = 'asked' and r.email_status = 'unsubscribed' and r.sms_opt_out and r.whatsapp_opt_out and r.consent_source = 'do not contact: asked') then
    raise exception 'w281live: crm_set_do_not_contact did not set the flag and the opt-outs';
  end if;
  if (select count(*) from public.crm_consent_events where contact_id = v_drop and source = 'do not contact: asked') <> 3 then raise exception 'w281live: do-not-contact did not write three log rows'; end if;
  foreach k in array array['transactional', 'newsletter', 'fundraising', 'volunteer'] loop
    select * into r from public.crm_email_permission(v_drop, k);
    if r.allowed or r.basis <> 'do not contact' then raise exception 'w281live: crm_email_permission let the % kind through', k; end if;
  end loop;
  insert into public.crm_contact_chapters (contact_id, chapter, source) values (v_drop, 'toronto', 'hand');
  insert into public.wa_campaign_people (campaign_id, contact_id, part, source) values (c_gbd, v_drop, 'donor', 'hand');
  insert into public.crm_contact_private (contact_id, birth_date, source) values (v_drop, ((now() at time zone 'America/Toronto')::date - interval '17 years')::date, 'test');
  if public.crm_age_band(v_drop) <> '16 to 17' then raise exception 'w281live: crm_age_band is wrong'; end if;
  select array_agg(id) into v_moved from public.crm_consent_events where contact_id = v_drop;
  perform public.crm_merge_contacts(v_keep, v_drop);
  select * into r from public.crm_contacts where id = v_keep;
  if not (r.do_not_contact and r.dnc_reason = 'asked' and r.job_title = 'Chef') then raise exception 'w281live: the merge did not carry do-not-contact and the job title'; end if;
  if exists (select 1 from public.crm_consent_events where id = any(v_moved) and contact_id <> v_keep) or exists (select 1 from public.crm_consent_events where contact_id = v_drop) then raise exception 'w281live: the merge did not move the consent rows'; end if;
  if not exists (select 1 from public.crm_contact_chapters where contact_id = v_keep and chapter = 'toronto') or not exists (select 1 from public.wa_campaign_people where contact_id = v_keep)
     or not exists (select 1 from public.crm_contact_private where contact_id = v_keep) then raise exception 'w281live: the merge did not move chapters, campaign rows or private data'; end if;
  if coalesce(current_setting('wa.consent_merge', true), '') = 'on' then raise exception 'w281live: wa.consent_merge stayed on'; end if;
  begin
    update public.crm_consent_events set words = 'x' where contact_id = v_keep;
    raise exception 'w281live: the consent log took an update';
  exception when raise_exception then
    if sqlerrm like 'w281live:%' then raise; end if;
  end;
  insert into public.crm_donations (contact_id, amount, donated_at, campaign, platform) values (v_keep, 1, now(), 'Holiday Gift Basket Drive 2026', 'other') returning id into g;
  if (select campaign_id from public.crm_donations where id = g) is distinct from c_gbd then raise exception 'w281live: a new drive gift was not linked'; end if;
  perform public.crm_set_do_not_contact(v_keep, null);
  perform set_config('wa.consent_source', '', true);
  if (select do_not_contact or email_status <> 'unsubscribed' from public.crm_contacts where id = v_keep) then raise exception 'w281live: clearing do-not-contact resubscribed or failed'; end if;
  perform set_config('request.jwt.claims', '', true);
end $live$;
