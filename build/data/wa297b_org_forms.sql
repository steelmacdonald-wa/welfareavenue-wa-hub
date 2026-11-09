-- wave297b (Steel, 08/11/26): the org chart on the three co-ED model, and one Toronto volunteer form.
-- Safe to run twice: every step checks first. Run in the Supabase SQL editor, then wa297_channels.sql.
begin;

-- 1. The co-executive directors: Shima, Ian, Suhaib in the Executive directors row
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'org_position', p.id::text, 'position', p.title || ' (' || p.kind || ', ' || p.department || ', reports to ' || coalesce(p.reports_to::text, 'none') || ')', x.t || ' (executive director)', 'Steel'
  from public.org_positions p
  join (values (9, 'Co-Executive Director, Marketing & Fundraising'), (36, 'Co-Executive Director, Montréal Operations & Program Development'),
               (12, 'Co-Executive Director, Finance & Grants and Ontario Operations')) x(id, t) on x.id = p.id
 where p.title is distinct from x.t;
update public.org_positions p set kind = 'exec', department = 'exec', reports_to = null, title = x.t, sort = x.s, updated_at = now(), updated_by = 'Steel (leadership model, 08/11/26)'
  from (values (9, 'Co-Executive Director, Marketing & Fundraising', 2), (36, 'Co-Executive Director, Montréal Operations & Program Development', 1),
               (12, 'Co-Executive Director, Finance & Grants and Ontario Operations', 3)) x(id, t, s)
 where p.id = x.id;
update public.team_members m set role = p.title from public.org_positions p where p.member_id = m.id and p.id in (9, 36, 12) and m.role is distinct from p.title;

-- 2. HR is shared by the three co-EDs: the HR lead no longer reports to Steel's seat
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'org_position', '1', 'reports_to', '8', 'none: HR is shared by the three co-executive directors', 'Steel' from public.org_positions where id = 1 and reports_to = 8;
update public.org_positions set reports_to = null, updated_at = now(), updated_by = 'Steel (HR shared by the co-EDs, 08/11/26)' where id = 1 and reports_to = 8;

-- 3. Steel moves to the board of directors (Chair / President); his executive seat goes
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'org_position', '8', 'removed', 'Founder, Co-ED, Board President (Steel)', 'Steel moves to the board of directors as Chair / President (08/11/26)', 'Steel'
  from public.org_positions where id = 8;
update public.team_members set position_id = null where position_id = 8;
delete from public.org_positions where id = 8 and not exists (select 1 from public.org_positions c where c.reports_to = 8);
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'team_member', '37', 'department', department, 'board (Chair / President of the Board)', 'Steel' from public.team_members where id = 37 and department <> 'board';
update public.team_members set department = 'board', role = 'Chair / President of the Board' where id = 37;

-- 4. One Toronto volunteer form, English only, for students and everyone
update public.crm_forms set
  title = 'Volunteer in Toronto',
  intro = E'Welfare Avenue Toronto brings volunteers and students together to cook free meals at a community kitchen and bring them to shelters, drop-ins and community organizations across the city, in partnership with the Toronto Youth Food Policy Council.\n\nOne form for everyone, students included. Pick how you would like to help and the events you can make, and our Toronto team will confirm with you before the day.',
  thank_you = 'Thank you for signing up to volunteer with Welfare Avenue in Toronto. Our team will confirm your event with you before the day.',
  lang = 'en',
  questions = $q$[
 {"id":"first_name","to":"contact.first_name","type":"text","label":"First name","required":true},
 {"id":"last_name","to":"contact.last_name","type":"text","label":"Last name","required":true},
 {"id":"email","to":"contact.email","type":"email","label":"Email","required":true},
 {"id":"phone","to":"contact.phone","type":"phone","label":"Phone","help":"We confirm the week of an event.","required":true},
 {"id":"role","to":"volunteer.roles","type":"choice","label":"How would you like to help?","required":true,"options":[
   {"v":"cook","l":"Cooking","d":"Cook with the team at the community kitchen. No experience needed."},
   {"v":"server","l":"Serving","d":"Bring the meals to the people we serve and hand them out with care."},
   {"v":"driver","l":"Driving (your own car)","d":"Carry the food and supplies from the kitchen to where the meals go. You need a licence."}]},
 {"id":"dates","to":"volunteer.dates","type":"serving_dates","label":"Which events can you make?","help":"Our Toronto events are on Sundays. Pick as many as you like; we confirm each one before the day.","required":false},
 {"id":"age_16","to":"field:age_16_plus","type":"yes_no","label":"Are you 16 or older?","required":true},
 {"id":"student","type":"yes_no","label":"Are you a student?","required":true},
 {"id":"school","type":"text","label":"If you are a student: which school, college or university?","help":"So we can bring your school or club into our Toronto events.","required":false},
 {"id":"photos","to":"field:photo_consent","type":"yes_no","label":"Are you okay with photos or videos of you being shared on our social media?","help":"Not a requirement to volunteer.","required":true},
 {"id":"experience","to":"field:food_nonprofit_experience","type":"long_text","label":"Have you volunteered with a food non-profit before?","help":"A line or two is plenty.","required":false},
 {"id":"reach","type":"multi","label":"How would you prefer to hear from us?","options":["Email","Text","WhatsApp group"],"required":false},
 {"id":"heard","type":"text","label":"How did you hear about us?","help":"For example Volunteer Toronto, your school, a friend or social media.","required":false},
 {"id":"support","to":"field:support_note","type":"long_text","label":"Anything we should know to support you?","help":"Only our team sees this.","required":false}
]$q$::jsonb,
  settings = settings || jsonb_build_object('org_from', 'school', 'student_tag_from', 'student'),
  status = 'published', published_at = coalesce(published_at, now()), published_by = coalesce(published_by, 'Steel (08/11/26)'), closed_at = null,
  updated_at = now(), updated_by = 'Steel (08/11/26 Toronto meeting: one form)'
 where slug = 'toronto-volunteer';
update public.crm_forms set status = 'closed', closed_at = now(), updated_at = now(), updated_by = 'Steel (08/11/26: merged into toronto-volunteer)'
 where slug = 'toronto-student' and status <> 'closed';
delete from public.crm_forms f where f.slug in ('benevole-toronto', 'etudiant-toronto') and f.status = 'draft'
   and not exists (select 1 from public.crm_form_submissions s where s.form_id = f.id);

-- 5. A "yes, I'm a student" answer tags the person toronto student (the Students filter in the Toronto volunteers)
create or replace function public.wa297_student_tag() returns trigger
language plpgsql security definer set search_path to '' as $$
declare q text;
begin
  if new.is_test or new.contact_id is null then return new; end if;
  select f.settings ->> 'student_tag_from' into q from public.crm_forms f where f.id = new.form_id;
  if q is null or coalesce(new.answers ->> q, '') not in ('true', 'yes') then return new; end if;
  update public.crm_contacts set tags = (select coalesce(array_agg(distinct x order by x), '{}') from unnest(coalesce(tags, '{}') || array['toronto student']) x)
   where id = new.contact_id and not ('toronto student' = any (coalesce(tags, '{}')));
  return new;
exception when others then
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('form_submission', new.id::text, 'student tag', null, 'wave297b: ' || left(sqlerrm, 300), 'wave297b');
  return new;
end $$;
comment on function public.wa297_student_tag() is 'wave297b: after a form answer is processed, a yes to the question named in the form''s settings.student_tag_from tags the CRM contact toronto student. Trigger only.';
revoke execute on function public.wa297_student_tag() from public, anon, authenticated;
drop trigger if exists wa297_student_tag on public.crm_form_submissions;
create trigger wa297_student_tag after update of status on public.crm_form_submissions
  for each row when (new.status = 'processed' and old.status is distinct from 'processed') execute function public.wa297_student_tag();

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values
 ('release', 'wave297b', 'wave297b', null, 'Org chart: Shima, Ian and Suhaib are the co-executive directors; Steel is on the board as Chair / President; HR shared. One Toronto form (toronto-volunteer, English) published; toronto-student closed; the two French drafts removed; students tagged toronto student.', 'wave297b');

select p.id, p.title, p.kind, m.name from public.org_positions p left join public.team_members m on m.id = p.member_id where p.kind = 'exec' order by p.sort;
commit;
