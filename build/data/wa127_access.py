#!/usr/bin/env python3
"""wave127 access profiles: writes wa127_access.sql (migration) and wa127_profiles.json (fixture seed).

One place defines the nine profiles and which pages each one opens:
  'all'  everyone with the profile
  'lead' only people with the profile who lead (hub_roles.role = leader)
  'none' nobody with the profile
A page missing from a profile's map is a page nobody has decided yet: it follows the
page's built-in gate (members, leaders or admins) until an admin decides, and the
Admin > Access profiles page lists it under "New pages to review".
"""
import json, os
D = os.path.dirname(os.path.abspath(__file__))

PAGES = [
    'mypage', 'calendar', 'requests', 'create', 'overview', 'dashboard', 'importantinfo', 'brain', 'photos',
    'training', 'orgchart', 'team', 'orggoals', 'goals', 'projects', 'goalmap',
    'opsmtl', 'volunteering', 'progdev', 'opsto', 'marketing', 'contentcal', 'socialstats', 'fundraising',
    'fundevents', 'finances', 'hr', 'hrcentre', 'board', 'governance', 'committees',
    'transcripts', 'agendas', 'hubmail', 'activity', 'adminpanel'
]
SHARED = ['mypage', 'calendar', 'requests', 'create', 'overview', 'dashboard', 'importantinfo', 'brain', 'photos',
          'training', 'orgchart', 'team', 'orggoals', 'goals', 'projects', 'goalmap',
          'opsmtl', 'volunteering', 'progdev', 'opsto', 'marketing', 'fundraising', 'hr', 'fundevents', 'transcripts']
LEAD_EXTRAS = {'contentcal': 'lead', 'socialstats': 'lead', 'finances': 'none', 'hrcentre': 'lead', 'board': 'lead',
               'governance': 'lead', 'committees': 'lead', 'agendas': 'lead', 'hubmail': 'none', 'activity': 'lead',
               'adminpanel': 'none'}


def team_pages(extra):
    m = {p: 'all' for p in SHARED}
    m.update(LEAD_EXTRAS)
    m.update(extra)
    assert set(m) == set(PAGES), sorted(set(PAGES) ^ set(m))
    return m


LEAD_NOTE = ('A lead also gets Agendas, Activity, the HR centre (onboarding and hours for their team), the board pages '
             'and Committees, can invite people into their own team, sees every team\'s requests and can add trainings '
             'to the academy.')

PROFILES = [
    dict(key='marketing', label='Marketing', team='marketing', tier='member', sort=10, color='#6F64AB',
         summary='Marketing, Branding and Web: content, design, social media and the website.',
         can=['Plan, write and schedule posts in the Content calendar',
              'Read every channel\'s numbers in Analytics',
              'Make branded emails, one-pagers and posts in the Create studio, with the Photo library',
              'Run the Marketing page: tasks, projects, agenda, goals and SOPs',
              'Answer the requests sent to Marketing in the team inbox'],
         pages=team_pages({'contentcal': 'all', 'socialstats': 'all'})),
    dict(key='fundraising', label='Fundraising & Finances', team='fundraising', tier='member', sort=20, color='#C87A2F',
         summary='Fundraising and Finances: events, partners, donors, grants and the books.',
         can=['Add and update fundraising events, and record what each one raised',
              'See the ledger, budgets, statements and charts in Finances, and import bank statements',
              'Read the Analytics numbers for partner and sponsor decks',
              'Run the Fundraising page: tasks, projects, agenda, goals and SOPs',
              'Answer the requests sent to Fundraising in the team inbox'],
         pages=team_pages({'finances': 'all', 'socialstats': 'all'})),
    dict(key='progdev', label='Program Development', team='progdev', tier='member', sort=30, color='#2A8C7A',
         summary='Program Development: our programs, research and data, and the people we serve.',
         can=['Run the Program Development page: tasks, projects, agenda, goals and SOPs',
              'Plan programs with Operations, with the shared calendar and MTL volunteering',
              'Use the transcripts, The Brain and the goals pages for research and reporting',
              'Answer the requests sent to Program Development in the team inbox'],
         pages=team_pages({})),
    dict(key='opsmtl', label='Operations Montreal', team='opsmtl', tier='member', sort=40, color='#103F39',
         summary='Operations Montreal: the serving events, volunteers and logistics in Montreal.',
         can=['Keep MTL volunteering up to date: serving events, sign-ups and check-ins',
              'Run the Operations Montreal page: tasks, projects, agenda, goals and SOPs',
              'Staff fundraising events from the events calendar',
              'Answer the requests sent to Operations Montreal in the team inbox'],
         pages=team_pages({})),
    dict(key='opsto', label='Operations Toronto', team='opsto', tier='member', sort=50, color='#3A6EA5',
         summary='Operations Toronto: the Toronto programs, partners and volunteers.',
         can=['Run the Operations Toronto page: tasks, projects, agenda, goals and SOPs',
              'Plan with the shared calendar and the events calendar',
              'Share photos and updates from the Toronto programs',
              'Answer the requests sent to Operations Toronto in the team inbox'],
         pages=team_pages({})),
    dict(key='hr', label='HR & People', team='hr', tier='member', sort=60, color='#B3402F',
         summary='HR and People: hiring, onboarding, hours, policies and looking after the team.',
         can=['Use the HR centre: onboarding plans, hours, recruitment and policies',
              'Run the Human Resources page: tasks, projects, agenda, goals and SOPs',
              'Answer the requests and job applications sent to HR in the team inbox',
              'Everyone\'s time off, discipline and policy sign-offs stay with the HR access list, not the whole team'],
         pages=team_pages({'hrcentre': 'all'})),
    dict(key='board', label='Board member', team=None, tier='viewer', sort=70, color='#4A4F57',
         summary='Directors and board advisers who are not on the staff team.',
         can=['Board overview: the next meeting, the three jobs, terms and the fiscal year at a glance (totals, never transactions)',
              'Committees: log your own touchpoints, update the items of the three jobs, edit a committee you chair',
              'The Executive dashboard, the shared calendar and the events calendar',
              'Analytics, the Content calendar and the Photo library'],
         pages={p: ('all' if p in ('overview', 'calendar', 'fundevents', 'photos', 'socialstats', 'contentcal', 'governance', 'committees') else 'none') for p in PAGES}),
    dict(key='executive', label='Executive', team=None, tier='leader', sort=80, color='#DCA527',
         summary='The executive directors and the leadership team: the whole organization.',
         can=['Every page except Admin: every team, Finances, the HR centre, the Hub inbox, Agendas and Activity',
              'Board overview and Committees: schedule board meetings and update the three jobs',
              'Every team\'s requests and the Slack settings for requests',
              'Add and assign trainings in the academy'],
         pages={p: ('none' if p == 'adminpanel' else 'all') for p in PAGES}),
    dict(key='admin', label='Admin', team=None, tier='admin', sort=90, color='#1F201E',
         summary='The people who run the Hub itself.',
         can=['Everything, including Admin: people and access, access profiles, AI models, security and the audit trail, changing the Hub',
              'Change anyone\'s profile or pages, invite and remove people',
              'Log a touchpoint on a director\'s behalf and delete board items'],
         pages={p: 'all' for p in PAGES}),
]
for p in PROFILES:
    p['lead_note'] = LEAD_NOTE if p['tier'] == 'member' else ''
    assert set(p['pages']) == set(PAGES), p['key']


def q(s):
    return 'null' if s is None else "'" + str(s).replace("'", "''") + "'"


def j(v):
    return q(json.dumps(v, ensure_ascii=False)) + '::jsonb'


sql = []
A = sql.append
A('-- wa127_access: access profiles (Admin > Access profiles), the finance lock by profile, board visibility for leads')
A('-- follows the profile, and two access holes closed (self-enrolment with pages or a profile; anyone on staff adding a board viewer).')
A('-- People with hand-picked pages (the classic override) keep the classic rules in the database until they get a profile.')
A('alter table public.hub_roles add column if not exists profile text;')
A('''create table if not exists public.hub_access_profiles (
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
);''')
A('''create table if not exists public.hub_access_settings (
  id int primary key default 1 check (id = 1),
  auto_profile boolean not null default false,
  applied_at timestamptz,
  applied_by text,
  reviewed_at timestamptz,
  reviewed_by text,
  updated_by text,
  updated_at timestamptz not null default now()
);''')
A('insert into public.hub_access_settings (id) values (1) on conflict (id) do nothing;')
A('alter table public.hub_access_profiles enable row level security;')
A('alter table public.hub_access_settings enable row level security;')
for t in ('hub_access_profiles', 'hub_access_settings'):
    A('drop policy if exists %s_read on public.%s;' % (t, t))
    A('drop policy if exists %s_write on public.%s;' % (t, t))
    A('create policy %s_read on public.%s for select to authenticated using ((select public.is_wa_staff()) or (select public.is_board_person()));' % (t, t))
    A('create policy %s_write on public.%s for all to authenticated using ((select public.is_hub_admin())) with check ((select public.is_hub_admin()));' % (t, t))
    A('grant select, insert, update, delete on public.%s to authenticated;' % t)

# the page check, the same rules as the Hub's menu
A('''create or replace function public.wa_page_ok(p_tab text)
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
$$;''')
A('grant execute on function public.wa_page_ok(text) to authenticated;')

# finances: the whole team as before, except people whose profile leaves Finances out
for t, pol in (('finance_transactions', 'fin_transactions_staff'), ('finance_budgets', 'fin_budgets_staff'), ('finance_statements', 'fin_statements_staff')):
    A('drop policy if exists %s on public.%s;' % (pol, t))
    A("create policy %s on public.%s for all to public using ((select public.is_wa_staff()) and coalesce((select public.wa_page_ok('finances')), true)) with check ((select public.is_wa_staff()) and coalesce((select public.wa_page_ok('finances')), true));" % (pol, t))

# the board: leaders see and run it when their profile opens the board pages
A('''create or replace function public.wa_board_leader()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select public.is_wa_admin() or (public.is_wa_leader() and coalesce(public.wa_page_ok('governance'), true));
$$;''')
A('grant execute on function public.wa_board_leader() to authenticated;')
A('''create or replace function public.can_see_board()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select public.is_board_person() or public.wa_board_leader();
$$;''')
A('''create or replace function public.board_me()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object('member_id', public.my_board_member_id(), 'board', public.is_board_person(), 'leader', public.wa_board_leader(), 'admin', public.is_wa_admin());
$$;''')
A('drop policy if exists board_committees_update on public.board_committees;')
A('create policy board_committees_update on public.board_committees for update to authenticated using ((select public.wa_board_leader()) or (chair_id = (select public.my_board_member_id()))) with check ((select public.wa_board_leader()) or (chair_id = (select public.my_board_member_id())));')
A('drop policy if exists board_items_insert on public.board_items;')
A('create policy board_items_insert on public.board_items for insert to authenticated with check ((select public.wa_board_leader()) or ((select public.my_board_member_id()) is not null));')
A('drop policy if exists board_items_update on public.board_items;')
A('create policy board_items_update on public.board_items for update to authenticated using ((select public.wa_board_leader()) or ((select public.my_board_member_id()) is not null)) with check ((select public.wa_board_leader()) or ((select public.my_board_member_id()) is not null));')
A('drop policy if exists board_meetings_write on public.board_meetings;')
A('create policy board_meetings_write on public.board_meetings for all to authenticated using ((select public.wa_board_leader())) with check ((select public.wa_board_leader()));')

# holes: self-enrolment could hand yourself pages or a profile; anyone on staff could add a board viewer
A('drop policy if exists hub_roles_self_member on public.hub_roles;')
A("create policy hub_roles_self_member on public.hub_roles for insert to authenticated with check (email = lower(coalesce(auth.jwt() ->> 'email', '')) and email like '%@welfareavenue.com' and role = 'member' and profile is null and tabs is null);")
A('drop policy if exists wa_staff_all_board_viewers on public.board_viewers;')
A('drop policy if exists board_viewers_read on public.board_viewers;')
A('drop policy if exists board_viewers_admin_write on public.board_viewers;')
A('create policy board_viewers_read on public.board_viewers for select to authenticated using ((select public.is_wa_staff()));')
A('create policy board_viewers_admin_write on public.board_viewers for all to authenticated using ((select public.is_hub_admin())) with check ((select public.is_hub_admin()));')

# new people get their team's profile once the switch is on
A('''create or replace function public.wa_auto_profile()
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
$$;''')
A('drop trigger if exists wa127_auto_profile on public.hub_roles;')
A('create trigger wa127_auto_profile after insert on public.hub_roles for each row execute function public.wa_auto_profile();')
A('drop trigger if exists wa127_auto_profile_tm on public.team_members;')
A('create trigger wa127_auto_profile_tm after insert or update of email, department on public.team_members for each row execute function public.wa_auto_profile();')

# the nine profiles
for p in PROFILES:
    A('insert into public.hub_access_profiles (key, label, tier, team, sort, color, summary, lead_note, can, pages, updated_by) values ('
      + ', '.join([q(p['key']), q(p['label']), q(p['tier']), q(p['team']), str(p['sort']), q(p['color']), q(p['summary']),
                   q(p['lead_note']), j(p['can']), j(p['pages']), q('wave127')])
      + ') on conflict (key) do nothing;')

open(os.path.join(D, 'wa127_access.sql'), 'w').write('\n'.join(sql) + '\n')
json.dump({'pages': PAGES, 'profiles': PROFILES}, open(os.path.join(D, 'wa127_profiles.json'), 'w'), ensure_ascii=False, indent=1)
print('wa127_access.sql', sum(len(s) for s in sql), 'chars;', len(PROFILES), 'profiles;', len(PAGES), 'pages')
