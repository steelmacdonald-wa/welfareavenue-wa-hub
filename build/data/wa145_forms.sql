-- wave145: Forms flows. The Google Forms Welfare Avenue uses, read by the forms-flow edge function every day, and what the
-- Hub does with each answer: the volunteer survey after each serving and the event audit go on the event in the Volunteering
-- manager, the recurrent volunteers sign-up goes into the volunteer list, and the two onboarding quizzes tick their step in
-- the person's onboarding. Written only by the function (service role).

create table if not exists public.form_sources (
  form_id text primary key,
  kind text not null check (kind in ('volunteer_feedback', 'event_audit', 'volunteer_signup', 'onboarding_quiz')),
  label text not null,
  title text,
  quiz_step text,
  responder_url text,
  edit_url text,
  enabled boolean not null default true,
  questions jsonb,
  responses_n int,
  last_response_at timestamptz,
  last_synced_at timestamptz,
  last_note text,
  sort int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.form_responses (
  response_id text primary key,
  form_id text not null references public.form_sources (form_id) on delete cascade,
  kind text not null,
  submitted_at timestamptz not null,
  respondent_email text,
  name text,
  answers jsonb not null default '[]'::jsonb,
  score numeric,
  max_score numeric,
  event_id bigint,
  member_id bigint,
  volunteer_id bigint,
  done jsonb,
  synced_at timestamptz not null default now()
);
create index if not exists form_responses_form on public.form_responses (form_id, submitted_at desc);
create index if not exists form_responses_event on public.form_responses (event_id);
create index if not exists form_responses_member on public.form_responses (member_id);

create table if not exists public.form_summaries (
  id bigserial primary key,
  form_id text not null references public.form_sources (form_id) on delete cascade,
  scope text not null,
  n int not null default 0,
  summary text,
  stats jsonb,
  model text,
  created_at timestamptz not null default now(),
  unique (form_id, scope)
);

alter table public.form_sources enable row level security;
alter table public.form_responses enable row level security;
alter table public.form_summaries enable row level security;

drop policy if exists form_sources_read on public.form_sources;
create policy form_sources_read on public.form_sources for select to authenticated using (public.is_wa_staff() or public.is_hub_admin());

/* the volunteering forms are read like the volunteer list (staff); a quiz is read by HR, the executive directors and the
   person who took it */
drop policy if exists form_responses_read on public.form_responses;
create policy form_responses_read on public.form_responses for select to authenticated using (
  (kind in ('volunteer_feedback', 'event_audit', 'volunteer_signup') and (public.is_wa_staff() or public.is_hub_admin()))
  or (kind = 'onboarding_quiz' and (public.wa_is_hr() or public.wa_org_editor()
      or lower(coalesce(respondent_email, '')) = any (public.my_emails())
      or exists (select 1 from public.team_members t where t.id = member_id and lower(coalesce(t.email, '')) = any (public.my_emails())))));

drop policy if exists form_summaries_read on public.form_summaries;
create policy form_summaries_read on public.form_summaries for select to authenticated using (public.is_wa_staff() or public.is_hub_admin());

revoke all on public.form_sources, public.form_responses, public.form_summaries from anon;
grant select on public.form_sources, public.form_responses, public.form_summaries to authenticated;

insert into public.form_sources (form_id, kind, label, quiz_step, sort) values
  ('1u7gY6pp3oGUbazOaR_tP1BXawAkjYhU-8s1AtP3XiTU', 'volunteer_feedback', 'Volunteer survey (after each serving)', null, 1),
  ('14VOIRYxbcUiG5QOWphAQB0nIefyKYufvFes4iQnEDmY', 'event_audit', 'Event audit and restock', null, 2),
  ('1f2hLK22_4JFKNexOUDJrwW2jkdapcJVQptEs0HpJJHI', 'volunteer_signup', 'Recurrent volunteers sign-up', null, 3),
  ('1p6jHDGNifquIl8BhYJipLeA8rnQ43tHUOH75lQp6cD0', 'onboarding_quiz', 'Policy quiz', '86e1cj9hv', 4),
  ('1EsOBjA2m7rEBtUDyz2PQKd-tYaWY-58mf6BhlyGjMwQ', 'onboarding_quiz', 'Week 4 onboarding quiz (30 day quiz)', '86e1cj9hw', 5)
on conflict (form_id) do update set kind = excluded.kind, label = excluded.label, quiz_step = excluded.quiz_step, sort = excluded.sort, updated_at = now();

comment on table public.form_sources is 'Forms flows (wave145): the Google Forms the Hub reads (forms-flow) and what each one feeds: volunteer_feedback (the survey volunteers fill in after a serving, shown on the event), event_audit (the event lead''s audit and restock form, shown on the event), volunteer_signup (the recurrent volunteers form, into volunteer_people for review), onboarding_quiz (ticks quiz_step, an onboarding_template id, in the person''s onboarding). questions is the form''s questions as last read.';
comment on table public.form_responses is 'Forms flows (wave145): each answer to a form in form_sources, as question and answer text in form order (answers), with the score for a quiz and what the Hub matched it to: event_id (volunteer_events), member_id (team_members), volunteer_id (volunteer_people). done says what the Hub did with it (volunteer created or updated, onboarding step ticked). The volunteering forms are read by staff; a quiz by HR, the executive directors and the person who took it.';
comment on table public.form_summaries is 'Forms flows (wave145): the router''s summary of the volunteer survey for one event (scope event:<id>), with the counts it was written from (stats) and how many answers (n).';
