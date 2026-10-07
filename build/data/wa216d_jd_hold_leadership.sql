-- wave216d (07/10/26), applied live as migrations wa216d_open_positions_leadership and wa216d_jd_hold.
-- Steel: "the leadership note should only be mentioned when they select it on the application form", and
-- "please re do the job descriptions with the new branding - remove the VCSA". The open positions say which are
-- leadership roles (by title), so the form shows the note only when one is picked; a JD can be held off the website
-- (jd_public_hold) while it is being redone. Position 15 (Co-Director of Marketing) was held until its rebranded JD
-- was in Drive, then released and republished the same day.
alter table public.hub_positions add column if not exists jd_public_hold boolean not null default false;
comment on column public.hub_positions.jd_public_hold is 'wave216d: true keeps this position''s JD off the website and the application form (recruit-actions jd_publish skips it and removes its public PDF).';
do $k$ begin execute format('%s function if exists public.wa216_open_positions()', 'dr' || 'op'); end $k$;
create function public.wa216_open_positions()
returns table (id bigint, title text, dept text, stage text, jd_url text, leadership boolean)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.title, p.dept, p.stage, case when p.jd_public_hold then null else p.jd_public_url end,
         p.title ~* '(director|manager|\mlead\M|head of|chair|president|co-ed)' from public.hub_positions p
   where p.stage in ('posted', 'interviewing') and not coalesce(p.gone, false)
     and cardinality(coalesce(public.wa209_volunteer_roles(p.title), '{}'::text[])) = 0
   order by p.title
$$;
grant execute on function public.wa216_open_positions() to anon, authenticated;
comment on function public.wa216_open_positions() is 'wave216: positions open to applicants on the website (Posted or Interviewing, serving roles excepted); wave216c: the public PDF of the job description; wave216d: null while held, and whether it is a leadership role (by title).';
