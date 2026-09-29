-- wa164_finance_own (29/09/26): Finance on its own, apart from Fundraising (wave164).
-- Steel: "It's a little repetitive here and still shows fundraising and finance being togther. these should be seperate", and
-- "for the Hub Inbox, all finance related emails like invoices, receipts, reimbursements should go straight to the finance slack
-- channel not fundraising" ("accounting-finance is the private channel"; he added the Hub's Slack app to it).
-- The team is Fundraising. Finance is its own key (finance) with no team page: its tasks, requests and emails live in the Finance
-- app, and its channel is #accounting-finance, where every money email is posted. Every change is guarded: running it twice
-- changes nothing, and nothing already posted in Slack is posted again.

-- 1. the team's name, and a Finance meeting on the calendar is not a Fundraising one
update public.dept_meta set label = 'Fundraising', short_label = 'Fundraising',
  calendar_match = coalesce((select jsonb_agg(x) from jsonb_array_elements_text(calendar_match) x where x <> 'finance meeting'), '[]'::jsonb),
  updated_at = now()
  where department = 'fundraising' and (label is distinct from 'Fundraising' or calendar_match ? 'finance meeting');

-- 2. the access profile keeps what it opens (the Finance app included) and loses the combined name
update public.hub_access_profiles set label = 'Fundraising', summary = 'Fundraising: events, partners, donors and grants.',
  can = (select jsonb_agg(case when x = 'See the ledger, budgets, statements and charts in Finances, and import bank statements'
                               then 'Open the Finance app (an app of its own): the ledger, budgets, statements and charts, and import bank statements' else x end)
         from jsonb_array_elements_text(can) x),
  updated_by = 'wave164', updated_at = now()
  where key = 'fundraising' and label = 'Fundraising & Finances';
update public.hub_access_profiles set can = (select jsonb_agg(replace(x, 'every team, Finances, the HR centre', 'every team, the Finance app, the HR centre')) from jsonb_array_elements_text(can) x),
  updated_by = 'wave164', updated_at = now()
  where key = 'executive' and can::text like '%every team, Finances, the HR centre%';

-- 3. Finance's tasks: the money tasks the Hub inbox filed under Fundraising's old Finance workstream
update public.dept_tasks set department = 'finance', subsection = 'Bills and receipts', updated_at = now()
  where department = 'fundraising' and subsection = 'Finance';

-- 4. the Hub inbox's money emails are Finance's. The notify record moves with them, so team-inbox (fired by the department
--    change) finds them already decided and posts nothing again.
update public.hub_mail set department = 'finance',
  filed = case when filed ? 'department' then jsonb_set(filed, '{department}', '"finance"') else filed end,
  notify = coalesce(notify, '{}'::jsonb) || jsonb_build_object('department', 'finance', 'decision', coalesce(notify ->> 'decision', 'file'),
             'moved_from', 'fundraising', 'moved_at', now(), 'moved_note', 'moved to Finance on 29/09/26 (wave164); not posted again')
  where kind = 'invoice' and department = 'fundraising';

-- 5. reimbursements and purchase orders go to Finance (they post in #accounting-finance)
update public.request_types set department = 'finance' where key in ('reimbursement', 'purchase-order') and department = 'fundraising';
update public.dept_requests set department = 'finance' where type_key in ('reimbursement', 'purchase-order') and department = 'fundraising';

-- 6. Finance's channel, and every money email is posted there (Steel: "all finance related emails ... should go straight to the finance slack channel")
update public.hub_settings set value = jsonb_set(jsonb_set(value, '{channels,finance}', '["accounting-finance"]'::jsonb, true),
    '{email_mode}', coalesce(value -> 'email_mode', '{}'::jsonb) || '{"finance": "always"}'::jsonb, true),
  updated_at = now(), updated_by = 'wave164'
  where key = 'team_inbox' and not (value -> 'channels' ? 'finance');

-- 7. a meeting tagged Finance is Finance's (it used to map to Fundraising), and Finance's tasks can go to the bank
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.apply_transcript_result(bigint, jsonb, text)'::regprocedure);
  if position('then ''finance''' in d) = 0 then
    d := replace(d, $r$    when v_tx.department ilike '%fundrais%' or v_tx.department ilike '%grant%' then 'fundraising'$r$,
      $r$    when v_tx.department = 'finance' or v_tx.department ilike 'financ%' then 'finance'   -- wave164: Finance is its own team, before Fundraising
    when v_tx.department ilike '%fundrais%' or v_tx.department ilike '%grant%' then 'fundraising'$r$);
    if position('then ''finance''' in d) = 0 then raise exception 'apply_transcript_result: the Fundraising line was not found'; end if;
    execute d;
  end if;
  d := pg_get_functiondef('public.bank_add_task(text, text, date, text, bigint, text)'::regprocedure);
  if position('''finance''' in d) = 0 then
    d := replace(d, $r$('opsmtl', 'progdev', 'opsto', 'marketing', 'fundraising', 'hr', 'board')$r$, $r$('opsmtl', 'progdev', 'opsto', 'marketing', 'fundraising', 'finance', 'hr', 'board')$r$);
    if position('''finance''' in d) = 0 then raise exception 'bank_add_task: the team list was not found'; end if;
    execute d;
  end if;
end $do$;

-- 8. the training: Hub module 4 (requests), module 9 (access profiles), the Finance page tour
update public.trainings set description = replace(description,
    'you follow it in My requests and get a Slack message when it is done.' || chr(10) || chr(10) || 'Your own team''s work',
    'you follow it in My requests and get a Slack message when it is done. Money goes to Finance, a team of its own apart from Fundraising: reimbursements and purchase approvals are requests to Finance, the Hub inbox sends it the invoices and receipts, and #accounting-finance hears about each one; Finance''s inbox and tasks are in the Finance app.' || chr(10) || chr(10) || 'Your own team''s work'),
  updated_at = now()
  where id = 42 and position('Money goes to Finance' in description) = 0 and position('you follow it in My requests and get a Slack message when it is done.' in description) > 0;
update public.trainings set description = replace(description, '(Marketing, Fundraising & Finances, Program Development,', '(Marketing, Fundraising, Program Development,'), updated_at = now()
  where id = 92 and position('Fundraising & Finances' in description) > 0;
update public.trainings set title = 'Page tour: Finance', description = 'Finance, an app of its own apart from Fundraising: the ledger, budgets, nonprofit health, and Finance''s own tasks and requests.', updated_at = now()
  where id = 73 and key = 'tour:finances' and title = 'Page tour: Finances';

-- 9. the release
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('release', 'wave164', 'hub_release', '6aca2aa3e9aaee3328098dedccab65a6', '2146ee67b705fac75753e30d48da5fb5 (Finance on its own: the team is Fundraising; Finance is an app of its own in gold with Tasks, its team inbox on the Overview and its section in the title; no tab strip or crumb repeating the rail inside an app (the HR centre too); money emails, reimbursements and purchase orders go to Finance and #accounting-finance)', 'wave164');

-- the record
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260929070000', 'wa164_finance_own', array[$m$update public.dept_meta set label = 'Fundraising', short_label = 'Fundraising',
  calendar_match = coalesce((select jsonb_agg(x) from jsonb_array_elements_text(calendar_match) x where x <> 'finance meeting'), '[]'::jsonb),
  updated_at = now()
  where department = 'fundraising' and (label is distinct from 'Fundraising' or calendar_match ? 'finance meeting')$m$,$m$update public.hub_access_profiles set label = 'Fundraising', summary = 'Fundraising: events, partners, donors and grants.',
  can = (select jsonb_agg(case when x = 'See the ledger, budgets, statements and charts in Finances, and import bank statements'
                               then 'Open the Finance app (an app of its own): the ledger, budgets, statements and charts, and import bank statements' else x end)
         from jsonb_array_elements_text(can) x),
  updated_by = 'wave164', updated_at = now()
  where key = 'fundraising' and label = 'Fundraising & Finances'$m$,$m$update public.hub_access_profiles set can = (select jsonb_agg(replace(x, 'every team, Finances, the HR centre', 'every team, the Finance app, the HR centre')) from jsonb_array_elements_text(can) x),
  updated_by = 'wave164', updated_at = now()
  where key = 'executive' and can::text like '%every team, Finances, the HR centre%'$m$,$m$update public.dept_tasks set department = 'finance', subsection = 'Bills and receipts', updated_at = now()
  where department = 'fundraising' and subsection = 'Finance'$m$,$m$update public.hub_mail set department = 'finance',
  filed = case when filed ? 'department' then jsonb_set(filed, '{department}', '"finance"') else filed end,
  notify = coalesce(notify, '{}'::jsonb) || jsonb_build_object('department', 'finance', 'decision', coalesce(notify ->> 'decision', 'file'),
             'moved_from', 'fundraising', 'moved_at', now(), 'moved_note', 'moved to Finance on 29/09/26 (wave164); not posted again')
  where kind = 'invoice' and department = 'fundraising'$m$,$m$update public.request_types set department = 'finance' where key in ('reimbursement', 'purchase-order') and department = 'fundraising'$m$,$m$update public.dept_requests set department = 'finance' where type_key in ('reimbursement', 'purchase-order') and department = 'fundraising'$m$,$m$update public.hub_settings set value = jsonb_set(jsonb_set(value, '{channels,finance}', '["accounting-finance"]'::jsonb, true),
    '{email_mode}', coalesce(value -> 'email_mode', '{}'::jsonb) || '{"finance": "always"}'::jsonb, true),
  updated_at = now(), updated_by = 'wave164'
  where key = 'team_inbox' and not (value -> 'channels' ? 'finance')$m$,$m$do $do$
declare d text;
begin
  d := pg_get_functiondef('public.apply_transcript_result(bigint, jsonb, text)'::regprocedure);
  if position('then ''finance''' in d) = 0 then
    d := replace(d, $r$    when v_tx.department ilike '%fundrais%' or v_tx.department ilike '%grant%' then 'fundraising'$r$,
      $r$    when v_tx.department = 'finance' or v_tx.department ilike 'financ%' then 'finance'   -- wave164: Finance is its own team, before Fundraising
    when v_tx.department ilike '%fundrais%' or v_tx.department ilike '%grant%' then 'fundraising'$r$);
    if position('then ''finance''' in d) = 0 then raise exception 'apply_transcript_result: the Fundraising line was not found'; end if;
    execute d;
  end if;
  d := pg_get_functiondef('public.bank_add_task(text, text, date, text, bigint, text)'::regprocedure);
  if position('''finance''' in d) = 0 then
    d := replace(d, $r$('opsmtl', 'progdev', 'opsto', 'marketing', 'fundraising', 'hr', 'board')$r$, $r$('opsmtl', 'progdev', 'opsto', 'marketing', 'fundraising', 'finance', 'hr', 'board')$r$);
    if position('''finance''' in d) = 0 then raise exception 'bank_add_task: the team list was not found'; end if;
    execute d;
  end if;
end $do$$m$,$m$update public.trainings set description = replace(description,
    'you follow it in My requests and get a Slack message when it is done.' || chr(10) || chr(10) || 'Your own team''s work',
    'you follow it in My requests and get a Slack message when it is done. Money goes to Finance, a team of its own apart from Fundraising: reimbursements and purchase approvals are requests to Finance, the Hub inbox sends it the invoices and receipts, and #accounting-finance hears about each one; Finance''s inbox and tasks are in the Finance app.' || chr(10) || chr(10) || 'Your own team''s work'),
  updated_at = now()
  where id = 42 and position('Money goes to Finance' in description) = 0 and position('you follow it in My requests and get a Slack message when it is done.' in description) > 0$m$,$m$update public.trainings set description = replace(description, '(Marketing, Fundraising & Finances, Program Development,', '(Marketing, Fundraising, Program Development,'), updated_at = now()
  where id = 92 and position('Fundraising & Finances' in description) > 0$m$,$m$update public.trainings set title = 'Page tour: Finance', description = 'Finance, an app of its own apart from Fundraising: the ledger, budgets, nonprofit health, and Finance''s own tasks and requests.', updated_at = now()
  where id = 73 and key = 'tour:finances' and title = 'Page tour: Finances'$m$,$m$insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('release', 'wave164', 'hub_release', '6aca2aa3e9aaee3328098dedccab65a6', '2146ee67b705fac75753e30d48da5fb5 (Finance on its own: the team is Fundraising; Finance is an app of its own in gold with Tasks, its team inbox on the Overview and its section in the title; no tab strip or crumb repeating the rail inside an app (the HR centre too); money emails, reimbursements and purchase orders go to Finance and #accounting-finance)', 'wave164')$m$]) on conflict (version) do update set name = excluded.name, statements = excluded.statements;
