-- wave273 (Steel 02/11/26): who emails come from and who replies reach; asking an applicant to use the volunteer form;
-- a cook's ingredients and delivery days on their page. Live functions are changed by exact replacement, so anything
-- that moved since this was written makes the whole migration fail rather than overwrite it.

-- Where each email comes from. mail-send reads this; a reply_to on our domain sends replies to the person handling it.
insert into public.app_config (key, value, updated_at) values ('mail_senders', $j${
  "routes": {"volunteer": "volunteer@welfareavenue.com", "operations": "operations@welfareavenue.com", "hr": "job@welfareavenue.com"},
  "templates": {
    "volunteer_assigned": "volunteer", "volunteer_assigned_fr": "volunteer",
    "volunteer_update": "volunteer", "volunteer_update_fr": "volunteer",
    "volunteer_signup_ask": "volunteer", "volunteer_signup_ask_fr": "volunteer",
    "volunteer_itinerary": "volunteer", "serving_reminder": "volunteer", "welcome_volunteer": "volunteer",
    "st_welcome_volunteer": "volunteer", "st_serving_reminder": "volunteer", "st_thanks_serving": "volunteer",
    "st_callout": "volunteer", "st_event_invite_volunteers": "volunteer",
    "signoff_ready": "volunteer", "signoff_ready_fr": "volunteer"
  }
}$j$, now())
on conflict (key) do update set value = excluded.value, updated_at = now();
insert into public.app_config (key, value, updated_at) values ('mail_from_hr', 'job@welfareavenue.com', now())
on conflict (key) do update set value = excluded.value, updated_at = now();

-- Replies reach whoever handles the role. Drivers moved to Ahmed at the 29/10/26 program leaders meeting.
update public.app_config set value = (value::jsonb || '{"driver": "ahmedfakhir@welfareavenue.com", "team_leader": "ahmedfakhir@welfareavenue.com"}'::jsonb)::text, updated_at = now() where key = 'volunteer_role_owners';

insert into public.crm_email_templates (key, name, kind, subject, preheader, html_body, text_body, vars, active, lang, description, created_by, updated_by)
values
 ('volunteer_signup_ask', 'Please sign up with the volunteer form', 'transactional', 'Thanks for applying to volunteer with Welfare Avenue', 'One short form and you can pick your dates.',
  E'<h1>Thanks for applying</h1>\n<p>Hi {{first_name|there}},</p>\n<p>Thank you for your interest in volunteering with Welfare Avenue! We received your application through {{source}}.</p>\n<p>To choose your role and the dates that work for you, please sign up with our volunteer form. It takes about two minutes, and we will send you everything you need after that.</p>\n<a class="btn" href="{{form_url}}">Sign up to volunteer</a>\n<p>Any questions? Just reply to this email.</p>',
  E'Hi {{first_name|there}},\n\nThank you for your interest in volunteering with Welfare Avenue! We received your application through {{source}}.\n\nTo choose your role and the dates that work for you, please sign up with our volunteer form. It takes about two minutes, and we will send you everything you need after that.\n\n{{form_url}}\n\nAny questions? Just reply to this email.',
  '["first_name","source","form_url"]'::jsonb, true, 'en', 'wave273: Ask to sign up, on Applicants received.', 'wave273', 'wave273'),
 ('volunteer_signup_ask_fr', 'Merci de vous inscrire avec le formulaire', 'transactional', 'Merci de votre candidature comme bénévole chez Welfare Avenue', 'Un court formulaire et vous choisissez vos dates.',
  E'<h1>Merci de votre candidature</h1>\n<p>Bonjour {{first_name|}},</p>\n<p>Merci de votre intérêt pour le bénévolat chez Welfare Avenue! Nous avons reçu votre candidature par {{source}}.</p>\n<p>Pour choisir votre rôle et les dates qui vous conviennent, merci de vous inscrire avec notre formulaire de bénévolat. Cela prend environ deux minutes, et nous vous enverrons ensuite tout ce qu''il vous faut.</p>\n<a class="btn" href="{{form_url}}">M''inscrire comme bénévole</a>\n<p>Des questions? Répondez simplement à ce courriel.</p>',
  E'Bonjour {{first_name|}},\n\nMerci de votre intérêt pour le bénévolat chez Welfare Avenue! Nous avons reçu votre candidature par {{source}}.\n\nPour choisir votre rôle et les dates qui vous conviennent, merci de vous inscrire avec notre formulaire de bénévolat. Cela prend environ deux minutes, et nous vous enverrons ensuite tout ce qu''il vous faut.\n\n{{form_url}}\n\nDes questions? Répondez simplement à ce courriel.',
  '["first_name","source","form_url"]'::jsonb, true, 'fr', 'wave273: Ask to sign up, on Applicants received.', 'wave273', 'wave273')
on conflict (key) do nothing;

create or replace function public.wa273_ask_signup(p_id bigint, p_send boolean default false)
returns jsonb language plpgsql security definer set search_path to '' as $f$
declare a public.volunteer_applications%rowtype; v_fr boolean; v_first text; v_src text; v_url text; v_key text; t record; v_me text; v_reply text; v_res record; v_out jsonb; v_note text; v_by text;
begin
  if not public.wa256_can_text() then raise exception 'Only leaders, HR, admins and the operations team can email volunteers.'; end if;
  select * into a from public.volunteer_applications where id = p_id;
  if not found then raise exception 'no such application'; end if;
  if coalesce(a.email, '') = '' then return jsonb_build_object('ok', false, 'error', 'This applicant has no email address.'); end if;
  if a.contact_id is null then return jsonb_build_object('ok', false, 'error', 'This applicant is not in the CRM yet.'); end if;
  v_fr := lower(coalesce(a.language, '')) like 'fr%';
  v_first := coalesce(nullif(split_part(trim(coalesce(a.name, '')), ' ', 1), ''), '');
  v_src := case a.source when 'cabm' then 'CABM' when 'fcabq' then 'JeBénévole' when 'email' then case when v_fr then 'courriel' else 'email' end
                         when 'linkedin' then 'LinkedIn' when 'referral' then case when v_fr then 'une recommandation' else 'a referral' end
                         when 'event' then case when v_fr then 'un événement' else 'an event' end else case when v_fr then 'notre équipe' else 'our team' end end;
  v_url := case when v_fr then 'https://www.welfareavenue.com/fr/benevolat/' else 'https://www.welfareavenue.com/volunteer/' end;
  v_key := case when v_fr then 'volunteer_signup_ask_fr' else 'volunteer_signup_ask' end;
  select subject, text_body into t from public.crm_email_templates where key = v_key and active;
  if not found then return jsonb_build_object('ok', false, 'error', 'The email is switched off.'); end if;
  v_me := lower(coalesce(auth.jwt()->>'email', ''));
  v_reply := case when v_me like '%@welfareavenue.com' then v_me else 'volunteer@welfareavenue.com' end;
  if not p_send then
    return jsonb_build_object('ok', true, 'to', a.email, 'from', 'volunteer@welfareavenue.com', 'reply', v_reply, 'subject', t.subject,
      'text', replace(replace(replace(replace(t.text_body, '{{first_name|there}}', coalesce(nullif(v_first, ''), 'there')), '{{first_name|}}', v_first), '{{source}}', v_src), '{{form_url}}', v_url));
  end if;
  begin
    perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '20000');
    select * into v_res from extensions.http(('POST', 'https://zwnmulmnvopclzcvytce.supabase.co/functions/v1/mail-send',
      array[extensions.http_header('x-wa-secret', public.get_secret('WA_TRIGGER_SECRET')),
            extensions.http_header('apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3bm11bG1udm9wY2x6Y3Z5dGNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NjQxMjUsImV4cCI6MjA5ODM0MDEyNX0.YVeW1e8ffqkp3nOWdEyYXx4Kq-Tms61uReqDgypt3A4'),
            extensions.http_header('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3bm11bG1udm9wY2x6Y3Z5dGNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NjQxMjUsImV4cCI6MjA5ODM0MDEyNX0.YVeW1e8ffqkp3nOWdEyYXx4Kq-Tms61uReqDgypt3A4')],
      'application/json',
      jsonb_build_object('action', 'send', 'template_key', v_key, 'contact_id', a.contact_id, 'reply_to', v_reply,
        'vars', jsonb_build_object('first_name', v_first, 'source', v_src, 'form_url', v_url))::text)::extensions.http_request);
    v_out := v_res.content::jsonb;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'No answer from the email service. Check the send log before trying again.');
  end;
  if coalesce(v_out->>'status', '') <> 'sent' then
    return jsonb_build_object('ok', false, 'error', case when v_out->>'status' = 'suppressed' then 'This person cannot get email from us: ' || coalesce(v_out->>'basis', 'not allowed') else coalesce(v_out->>'error', 'The email did not go.') end);
  end if;
  v_note := 'Asked to sign up by email';
  perform public.wa209_vol_app_status(p_id, case when a.status = 'received' then 'contacted' else a.status end, v_note);
  v_by := coalesce((select m.name from public.team_members m where lower(m.email) = v_me limit 1), v_me);
  return jsonb_build_object('ok', true, 'to', a.email, 'status', case when a.status = 'received' then 'contacted' else a.status end, 'note', v_note, 'by', v_by);
end $f$;
comment on function public.wa273_ask_signup(bigint, boolean) is 'wave273: Ask to sign up on Applicants received. p_send false returns the email to preview; true sends it from volunteer@ with replies to the sender and moves the application to Contacted. Same people as wa256_can_text.';
revoke all on function public.wa273_ask_signup(bigint, boolean) from public, anon;
grant execute on function public.wa273_ask_signup(bigint, boolean) to authenticated;

-- Exact replacements in live functions
do $do$
declare v text;
  function_missing text := 'a live function moved: ';
begin
  -- the page saves a cook's ingredients and delivery days
  v := pg_get_functiondef('public.volunteer_confirm_details'::regproc);
  if position($x$if p ? 'donations' then v_add$x$ in v) = 0 then raise exception '%volunteer_confirm_details', function_missing; end if;
  v := replace(v, $x$if p ? 'donations' then v_add$x$, $x$if lower(r.role) = 'cook' and p->>'ingredients' in ('need', 'own') then   -- wave273
    v_add := v_add || jsonb_build_object('ingredients', p->>'ingredients', 'delivery_windows', case when p->>'ingredients' = 'need' then coalesce((select jsonb_agg(d) from jsonb_array_elements_text(case when jsonb_typeof(p->'delivery_windows') = 'array' then p->'delivery_windows' else '[]'::jsonb end) d where d in ('wed', 'thu', 'fri', 'sun')), '[]'::jsonb) else '[]'::jsonb end);
    update public.event_roster set detail = coalesce(detail, '{}'::jsonb) || jsonb_build_object('ingredients_delivered', case when p->>'ingredients' = 'need' then 'Yes' else 'No' end) where id = r.id;
  end if;
  if p ? 'donations' then v_add$x$);
  execute v;

  -- the page reads them back
  v := pg_get_functiondef('public.volunteer_confirm_get'::regproc);
  if position($x$'donations', r.confirm->>'donations',$x$ in v) = 0 then raise exception '%volunteer_confirm_get', function_missing; end if;
  v := replace(v, $x$'donations', r.confirm->>'donations',$x$, $x$'ingredients', r.confirm->>'ingredients', 'delivery_windows', r.confirm->'delivery_windows', 'donations', r.confirm->>'donations',$x$);
  execute v;

  -- replies reach whoever handles the role
  v := pg_get_functiondef('public.wa266_confirm_email'::regproc);
  if position($x$'contact_id', (v_em->>'contact_id')::bigint,$x$ in v) = 0 then raise exception '%wa266_confirm_email', function_missing; end if;
  v := replace(v, $x$'contact_id', (v_em->>'contact_id')::bigint,$x$, $x$'contact_id', (v_em->>'contact_id')::bigint, 'reply_to', public.wa258_role_owner(r.role),$x$);
  execute v;

  v := pg_get_functiondef('public.wa266f_email_drain'::regproc);
  if position($x$'contact_id', (public.wa182_roster_email(q.roster_id)->>'contact_id')::bigint,$x$ in v) = 0 then raise exception '%wa266f_email_drain', function_missing; end if;
  v := replace(v, $x$'contact_id', (public.wa182_roster_email(q.roster_id)->>'contact_id')::bigint,$x$, $x$'contact_id', (public.wa182_roster_email(q.roster_id)->>'contact_id')::bigint, 'reply_to', public.wa258_role_owner(r.role),$x$);
  execute v;

  -- placing someone: replies reach the person who placed them, and one email rather than two
  v := pg_get_functiondef('public.wa257_assign'::regproc);
  if position($x$'contact_id', (v_em->>'contact_id')::bigint,$x$ in v) = 0 or position($x$if p_text and coalesce(array_length(v_rows, 1), 0) > 0 then$x$ in v) = 0 then raise exception '%wa257_assign', function_missing; end if;
  v := replace(v, $x$'contact_id', (v_em->>'contact_id')::bigint,$x$, $x$'contact_id', (v_em->>'contact_id')::bigint, 'reply_to', v_by,$x$);
  v := replace(v, $x$if p_text and coalesce(array_length(v_rows, 1), 0) > 0 then$x$, $x$if p_text and p_email and coalesce(array_length(v_rows, 1), 0) > 0 and coalesce((select value from public.app_config where key = 'texts_by_email'), 'off') = 'on' and (public.wa182_roster_email(v_rows[1])->>'contact_id') is not null then
    v_text := 'by email instead';   -- wave273
  elsif p_text and coalesce(array_length(v_rows, 1), 0) > 0 then$x$);
  execute v;
end $do$;

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('release', 'wave273', 'wave273a', null, 'Senders: volunteer@ for volunteer emails, job@ for HR offers, operations@ ready; replies to the person handling it. Ask to sign up (wa273_ask_signup). A cook''s ingredients and delivery days saved from their page.', 'wave273');
