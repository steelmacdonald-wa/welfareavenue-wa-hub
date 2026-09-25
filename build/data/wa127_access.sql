-- wa127_access: access profiles (Admin > Access profiles), the finance lock by profile, board visibility for leads
-- follows the profile, and two access holes closed (self-enrolment with pages or a profile; anyone on staff adding a board viewer).
-- People with hand-picked pages (the classic override) keep the classic rules in the database until they get a profile.
alter table public.hub_roles add column if not exists profile text;
create table if not exists public.hub_access_profiles (
  key text primary key,
  label text not null,
  tier text not null default 'member' check (tier in ('viewer', 'member', 'leader', 'admin')),
  team text,
  sort int not null default 0,
  color text,
  summary text,
  lead_note text,
  can jsonb not null default '[]'::jsonb,
  pages jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);
create table if not exists public.hub_access_settings (
  id int primary key default 1 check (id = 1),
  auto_profile boolean not null default false,
  applied_at timestamptz,
  applied_by text,
  reviewed_at timestamptz,
  reviewed_by text,
  updated_by text,
  updated_at timestamptz not null default now()
);
insert into public.hub_access_settings (id) values (1) on conflict (id) do nothing;
alter table public.hub_access_profiles enable row level security;
alter table public.hub_access_settings enable row level security;
drop policy if exists hub_access_profiles_read on public.hub_access_profiles;
drop policy if exists hub_access_profiles_write on public.hub_access_profiles;
create policy hub_access_profiles_read on public.hub_access_profiles for select to authenticated using ((select public.is_wa_staff()) or (select public.is_board_person()));
create policy hub_access_profiles_write on public.hub_access_profiles for all to authenticated using ((select public.is_hub_admin())) with check ((select public.is_hub_admin()));
grant select, insert, update, delete on public.hub_access_profiles to authenticated;
drop policy if exists hub_access_settings_read on public.hub_access_settings;
drop policy if exists hub_access_settings_write on public.hub_access_settings;
create policy hub_access_settings_read on public.hub_access_settings for select to authenticated using ((select public.is_wa_staff()) or (select public.is_board_person()));
create policy hub_access_settings_write on public.hub_access_settings for all to authenticated using ((select public.is_hub_admin())) with check ((select public.is_hub_admin()));
grant select, insert, update, delete on public.hub_access_settings to authenticated;
create or replace function public.wa_page_ok(p_tab text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select case
    when public.wa_email() = '' then false
    when r.email is null then null
    when r.role = 'blocked' then false
    when r.role = 'admin' then true
    when jsonb_typeof(r.tabs) = 'array' and jsonb_array_length(r.tabs) > 0 then null
    when p.key is null then null
    when (case r.role when 'viewer' then 0 when 'member' then 1 when 'leader' then 2 when 'admin' then 3 else -1 end)
       < (case p.tier when 'viewer' then 0 when 'member' then 1 when 'leader' then 2 when 'admin' then 3 else 9 end) then null
    when (p.pages -> p_tab) is null then null
    else case p.pages ->> p_tab when 'all' then true when 'lead' then r.role in ('leader', 'admin') else false end
  end
  from (select 1) one
  left join public.hub_roles r on r.email = public.wa_email()
  left join public.hub_access_profiles p on p.key = r.profile;
$$;
grant execute on function public.wa_page_ok(text) to authenticated;
drop policy if exists fin_transactions_staff on public.finance_transactions;
create policy fin_transactions_staff on public.finance_transactions for all to public using ((select public.is_wa_staff()) and coalesce((select public.wa_page_ok('finances')), true)) with check ((select public.is_wa_staff()) and coalesce((select public.wa_page_ok('finances')), true));
drop policy if exists fin_budgets_staff on public.finance_budgets;
create policy fin_budgets_staff on public.finance_budgets for all to public using ((select public.is_wa_staff()) and coalesce((select public.wa_page_ok('finances')), true)) with check ((select public.is_wa_staff()) and coalesce((select public.wa_page_ok('finances')), true));
drop policy if exists fin_statements_staff on public.finance_statements;
create policy fin_statements_staff on public.finance_statements for all to public using ((select public.is_wa_staff()) and coalesce((select public.wa_page_ok('finances')), true)) with check ((select public.is_wa_staff()) and coalesce((select public.wa_page_ok('finances')), true));
create or replace function public.wa_board_leader()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select public.is_wa_admin() or (public.is_wa_leader() and coalesce(public.wa_page_ok('governance'), true));
$$;
grant execute on function public.wa_board_leader() to authenticated;
create or replace function public.can_see_board()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select public.is_board_person() or public.wa_board_leader();
$$;
create or replace function public.board_me()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object('member_id', public.my_board_member_id(), 'board', public.is_board_person(), 'leader', public.wa_board_leader(), 'admin', public.is_wa_admin());
$$;
drop policy if exists board_committees_update on public.board_committees;
create policy board_committees_update on public.board_committees for update to authenticated using ((select public.wa_board_leader()) or (chair_id = (select public.my_board_member_id()))) with check ((select public.wa_board_leader()) or (chair_id = (select public.my_board_member_id())));
drop policy if exists board_items_insert on public.board_items;
create policy board_items_insert on public.board_items for insert to authenticated with check ((select public.wa_board_leader()) or ((select public.my_board_member_id()) is not null));
drop policy if exists board_items_update on public.board_items;
create policy board_items_update on public.board_items for update to authenticated using ((select public.wa_board_leader()) or ((select public.my_board_member_id()) is not null)) with check ((select public.wa_board_leader()) or ((select public.my_board_member_id()) is not null));
drop policy if exists board_meetings_write on public.board_meetings;
create policy board_meetings_write on public.board_meetings for all to authenticated using ((select public.wa_board_leader())) with check ((select public.wa_board_leader()));
drop policy if exists hub_roles_self_member on public.hub_roles;
create policy hub_roles_self_member on public.hub_roles for insert to authenticated with check (email = lower(coalesce(auth.jwt() ->> 'email', '')) and email like '%@welfareavenue.com' and role = 'member' and profile is null and tabs is null);
drop policy if exists wa_staff_all_board_viewers on public.board_viewers;
drop policy if exists board_viewers_read on public.board_viewers;
drop policy if exists board_viewers_admin_write on public.board_viewers;
create policy board_viewers_read on public.board_viewers for select to authenticated using ((select public.is_wa_staff()));
create policy board_viewers_admin_write on public.board_viewers for all to authenticated using ((select public.is_hub_admin())) with check ((select public.is_hub_admin()));
create or replace function public.wa_auto_profile()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_dept text;
  v_key text;
begin
  if not coalesce((select s.auto_profile from public.hub_access_settings s where s.id = 1), false) then return null; end if;
  if tg_table_name = 'hub_roles' then
    if new.profile is not null or new.role not in ('member', 'leader') or (jsonb_typeof(new.tabs) = 'array' and jsonb_array_length(new.tabs) > 0) then return null; end if;
    select m.department into v_dept from public.team_members m where lower(m.email) = new.email and m.active is not false order by m.id limit 1;
    select p.key into v_key from public.hub_access_profiles p where (p.team = v_dept and p.tier = 'member') or (v_dept = 'board' and new.role = 'member' and p.key = 'board') order by p.sort limit 1;
    if v_key is not null then update public.hub_roles set profile = v_key where email = new.email and profile is null; end if;
  else
    if new.email is null or new.department is null then return null; end if;
    select p.key into v_key from public.hub_access_profiles p where (p.team = new.department and p.tier = 'member') or (new.department = 'board' and p.key = 'board') order by p.sort limit 1;
    if v_key is not null then
      update public.hub_roles r set profile = v_key
       where r.email = lower(new.email) and r.profile is null and r.role in ('member', 'leader')
         and (v_key <> 'board' or r.role = 'member')
         and not (jsonb_typeof(r.tabs) = 'array' and jsonb_array_length(r.tabs) > 0);
    end if;
  end if;
  return null;
end;
$$;
drop trigger if exists wa127_auto_profile on public.hub_roles;
create trigger wa127_auto_profile after insert on public.hub_roles for each row execute function public.wa_auto_profile();
drop trigger if exists wa127_auto_profile_tm on public.team_members;
create trigger wa127_auto_profile_tm after insert or update of email, department on public.team_members for each row execute function public.wa_auto_profile();
insert into public.hub_access_profiles (key, label, tier, team, sort, color, summary, lead_note, can, pages, updated_by) values ('marketing', 'Marketing', 'member', 'marketing', 10, '#6F64AB', 'Marketing, Branding and Web: content, design, social media and the website.', 'A lead also gets Agendas, Activity, the HR centre (onboarding and hours for their team), the board pages and Committees, can invite people into their own team, sees every team''s requests and can add trainings to the academy.', '["Plan, write and schedule posts in the Content calendar", "Read every channel''s numbers in Analytics", "Make branded emails, one-pagers and posts in the Create studio, with the Photo library", "Run the Marketing page: tasks, projects, agenda, goals and SOPs", "Answer the requests sent to Marketing in the team inbox"]'::jsonb, '{"mypage": "all", "calendar": "all", "requests": "all", "create": "all", "overview": "all", "dashboard": "all", "importantinfo": "all", "brain": "all", "photos": "all", "training": "all", "orgchart": "all", "team": "all", "orggoals": "all", "goals": "all", "projects": "all", "goalmap": "all", "opsmtl": "all", "volunteering": "all", "progdev": "all", "opsto": "all", "marketing": "all", "fundraising": "all", "hr": "all", "fundevents": "all", "transcripts": "all", "contentcal": "all", "socialstats": "all", "finances": "none", "hrcentre": "lead", "board": "lead", "governance": "lead", "committees": "lead", "agendas": "lead", "hubmail": "none", "activity": "lead", "adminpanel": "none"}'::jsonb, 'wave127') on conflict (key) do nothing;
insert into public.hub_access_profiles (key, label, tier, team, sort, color, summary, lead_note, can, pages, updated_by) values ('fundraising', 'Fundraising & Finances', 'member', 'fundraising', 20, '#C87A2F', 'Fundraising and Finances: events, partners, donors, grants and the books.', 'A lead also gets Agendas, Activity, the HR centre (onboarding and hours for their team), the board pages and Committees, can invite people into their own team, sees every team''s requests and can add trainings to the academy.', '["Add and update fundraising events, and record what each one raised", "See the ledger, budgets, statements and charts in Finances, and import bank statements", "Read the Analytics numbers for partner and sponsor decks", "Run the Fundraising page: tasks, projects, agenda, goals and SOPs", "Answer the requests sent to Fundraising in the team inbox"]'::jsonb, '{"mypage": "all", "calendar": "all", "requests": "all", "create": "all", "overview": "all", "dashboard": "all", "importantinfo": "all", "brain": "all", "photos": "all", "training": "all", "orgchart": "all", "team": "all", "orggoals": "all", "goals": "all", "projects": "all", "goalmap": "all", "opsmtl": "all", "volunteering": "all", "progdev": "all", "opsto": "all", "marketing": "all", "fundraising": "all", "hr": "all", "fundevents": "all", "transcripts": "all", "contentcal": "lead", "socialstats": "all", "finances": "all", "hrcentre": "lead", "board": "lead", "governance": "lead", "committees": "lead", "agendas": "lead", "hubmail": "none", "activity": "lead", "adminpanel": "none"}'::jsonb, 'wave127') on conflict (key) do nothing;
insert into public.hub_access_profiles (key, label, tier, team, sort, color, summary, lead_note, can, pages, updated_by) values ('progdev', 'Program Development', 'member', 'progdev', 30, '#2A8C7A', 'Program Development: our programs, research and data, and the people we serve.', 'A lead also gets Agendas, Activity, the HR centre (onboarding and hours for their team), the board pages and Committees, can invite people into their own team, sees every team''s requests and can add trainings to the academy.', '["Run the Program Development page: tasks, projects, agenda, goals and SOPs", "Plan programs with Operations, with the shared calendar and MTL volunteering", "Use the transcripts, The Brain and the goals pages for research and reporting", "Answer the requests sent to Program Development in the team inbox"]'::jsonb, '{"mypage": "all", "calendar": "all", "requests": "all", "create": "all", "overview": "all", "dashboard": "all", "importantinfo": "all", "brain": "all", "photos": "all", "training": "all", "orgchart": "all", "team": "all", "orggoals": "all", "goals": "all", "projects": "all", "goalmap": "all", "opsmtl": "all", "volunteering": "all", "progdev": "all", "opsto": "all", "marketing": "all", "fundraising": "all", "hr": "all", "fundevents": "all", "transcripts": "all", "contentcal": "lead", "socialstats": "lead", "finances": "none", "hrcentre": "lead", "board": "lead", "governance": "lead", "committees": "lead", "agendas": "lead", "hubmail": "none", "activity": "lead", "adminpanel": "none"}'::jsonb, 'wave127') on conflict (key) do nothing;
insert into public.hub_access_profiles (key, label, tier, team, sort, color, summary, lead_note, can, pages, updated_by) values ('opsmtl', 'Operations Montreal', 'member', 'opsmtl', 40, '#103F39', 'Operations Montreal: the serving events, volunteers and logistics in Montreal.', 'A lead also gets Agendas, Activity, the HR centre (onboarding and hours for their team), the board pages and Committees, can invite people into their own team, sees every team''s requests and can add trainings to the academy.', '["Keep MTL volunteering up to date: serving events, sign-ups and check-ins", "Run the Operations Montreal page: tasks, projects, agenda, goals and SOPs", "Staff fundraising events from the events calendar", "Answer the requests sent to Operations Montreal in the team inbox"]'::jsonb, '{"mypage": "all", "calendar": "all", "requests": "all", "create": "all", "overview": "all", "dashboard": "all", "importantinfo": "all", "brain": "all", "photos": "all", "training": "all", "orgchart": "all", "team": "all", "orggoals": "all", "goals": "all", "projects": "all", "goalmap": "all", "opsmtl": "all", "volunteering": "all", "progdev": "all", "opsto": "all", "marketing": "all", "fundraising": "all", "hr": "all", "fundevents": "all", "transcripts": "all", "contentcal": "lead", "socialstats": "lead", "finances": "none", "hrcentre": "lead", "board": "lead", "governance": "lead", "committees": "lead", "agendas": "lead", "hubmail": "none", "activity": "lead", "adminpanel": "none"}'::jsonb, 'wave127') on conflict (key) do nothing;
insert into public.hub_access_profiles (key, label, tier, team, sort, color, summary, lead_note, can, pages, updated_by) values ('opsto', 'Operations Toronto', 'member', 'opsto', 50, '#3A6EA5', 'Operations Toronto: the Toronto programs, partners and volunteers.', 'A lead also gets Agendas, Activity, the HR centre (onboarding and hours for their team), the board pages and Committees, can invite people into their own team, sees every team''s requests and can add trainings to the academy.', '["Run the Operations Toronto page: tasks, projects, agenda, goals and SOPs", "Plan with the shared calendar and the events calendar", "Share photos and updates from the Toronto programs", "Answer the requests sent to Operations Toronto in the team inbox"]'::jsonb, '{"mypage": "all", "calendar": "all", "requests": "all", "create": "all", "overview": "all", "dashboard": "all", "importantinfo": "all", "brain": "all", "photos": "all", "training": "all", "orgchart": "all", "team": "all", "orggoals": "all", "goals": "all", "projects": "all", "goalmap": "all", "opsmtl": "all", "volunteering": "all", "progdev": "all", "opsto": "all", "marketing": "all", "fundraising": "all", "hr": "all", "fundevents": "all", "transcripts": "all", "contentcal": "lead", "socialstats": "lead", "finances": "none", "hrcentre": "lead", "board": "lead", "governance": "lead", "committees": "lead", "agendas": "lead", "hubmail": "none", "activity": "lead", "adminpanel": "none"}'::jsonb, 'wave127') on conflict (key) do nothing;
insert into public.hub_access_profiles (key, label, tier, team, sort, color, summary, lead_note, can, pages, updated_by) values ('hr', 'HR & People', 'member', 'hr', 60, '#B3402F', 'HR and People: hiring, onboarding, hours, policies and looking after the team.', 'A lead also gets Agendas, Activity, the HR centre (onboarding and hours for their team), the board pages and Committees, can invite people into their own team, sees every team''s requests and can add trainings to the academy.', '["Use the HR centre: onboarding plans, hours, recruitment and policies", "Run the Human Resources page: tasks, projects, agenda, goals and SOPs", "Answer the requests and job applications sent to HR in the team inbox", "Everyone''s time off, discipline and policy sign-offs stay with the HR access list, not the whole team"]'::jsonb, '{"mypage": "all", "calendar": "all", "requests": "all", "create": "all", "overview": "all", "dashboard": "all", "importantinfo": "all", "brain": "all", "photos": "all", "training": "all", "orgchart": "all", "team": "all", "orggoals": "all", "goals": "all", "projects": "all", "goalmap": "all", "opsmtl": "all", "volunteering": "all", "progdev": "all", "opsto": "all", "marketing": "all", "fundraising": "all", "hr": "all", "fundevents": "all", "transcripts": "all", "contentcal": "lead", "socialstats": "lead", "finances": "none", "hrcentre": "all", "board": "lead", "governance": "lead", "committees": "lead", "agendas": "lead", "hubmail": "none", "activity": "lead", "adminpanel": "none"}'::jsonb, 'wave127') on conflict (key) do nothing;
insert into public.hub_access_profiles (key, label, tier, team, sort, color, summary, lead_note, can, pages, updated_by) values ('board', 'Board member', 'viewer', null, 70, '#4A4F57', 'Directors and board advisers who are not on the staff team.', '', '["Board overview: the next meeting, the three jobs, terms and the fiscal year at a glance (totals, never transactions)", "Committees: log your own touchpoints, update the items of the three jobs, edit a committee you chair", "The Executive dashboard, the shared calendar and the events calendar", "Analytics, the Content calendar and the Photo library"]'::jsonb, '{"mypage": "none", "calendar": "all", "requests": "none", "create": "none", "overview": "all", "dashboard": "none", "importantinfo": "none", "brain": "none", "photos": "all", "training": "none", "orgchart": "none", "team": "none", "orggoals": "none", "goals": "none", "projects": "none", "goalmap": "none", "opsmtl": "none", "volunteering": "none", "progdev": "none", "opsto": "none", "marketing": "none", "contentcal": "all", "socialstats": "all", "fundraising": "none", "fundevents": "all", "finances": "none", "hr": "none", "hrcentre": "none", "board": "none", "governance": "all", "committees": "all", "transcripts": "none", "agendas": "none", "hubmail": "none", "activity": "none", "adminpanel": "none"}'::jsonb, 'wave127') on conflict (key) do nothing;
insert into public.hub_access_profiles (key, label, tier, team, sort, color, summary, lead_note, can, pages, updated_by) values ('executive', 'Executive', 'leader', null, 80, '#DCA527', 'The executive directors and the leadership team: the whole organization.', '', '["Every page except Admin: every team, Finances, the HR centre, the Hub inbox, Agendas and Activity", "Board overview and Committees: schedule board meetings and update the three jobs", "Every team''s requests and the Slack settings for requests", "Add and assign trainings in the academy"]'::jsonb, '{"mypage": "all", "calendar": "all", "requests": "all", "create": "all", "overview": "all", "dashboard": "all", "importantinfo": "all", "brain": "all", "photos": "all", "training": "all", "orgchart": "all", "team": "all", "orggoals": "all", "goals": "all", "projects": "all", "goalmap": "all", "opsmtl": "all", "volunteering": "all", "progdev": "all", "opsto": "all", "marketing": "all", "contentcal": "all", "socialstats": "all", "fundraising": "all", "fundevents": "all", "finances": "all", "hr": "all", "hrcentre": "all", "board": "all", "governance": "all", "committees": "all", "transcripts": "all", "agendas": "all", "hubmail": "all", "activity": "all", "adminpanel": "none"}'::jsonb, 'wave127') on conflict (key) do nothing;
insert into public.hub_access_profiles (key, label, tier, team, sort, color, summary, lead_note, can, pages, updated_by) values ('admin', 'Admin', 'admin', null, 90, '#1F201E', 'The people who run the Hub itself.', '', '["Everything, including Admin: people and access, access profiles, AI models, security and the audit trail, changing the Hub", "Change anyone''s profile or pages, invite and remove people", "Log a touchpoint on a director''s behalf and delete board items"]'::jsonb, '{"mypage": "all", "calendar": "all", "requests": "all", "create": "all", "overview": "all", "dashboard": "all", "importantinfo": "all", "brain": "all", "photos": "all", "training": "all", "orgchart": "all", "team": "all", "orggoals": "all", "goals": "all", "projects": "all", "goalmap": "all", "opsmtl": "all", "volunteering": "all", "progdev": "all", "opsto": "all", "marketing": "all", "contentcal": "all", "socialstats": "all", "fundraising": "all", "fundevents": "all", "finances": "all", "hr": "all", "hrcentre": "all", "board": "all", "governance": "all", "committees": "all", "transcripts": "all", "agendas": "all", "hubmail": "all", "activity": "all", "adminpanel": "all"}'::jsonb, 'wave127') on conflict (key) do nothing;
