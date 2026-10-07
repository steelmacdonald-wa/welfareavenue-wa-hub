-- wave216c (07/10/26): Steel: "I'd also like to link job descriptions from our google drive both on the application and in the
-- positions tab of HR center". The open positions' JDs are published as PDFs in public storage by recruit-actions jd_publish
-- (the Drive folders stay private); wa216_open_positions now returns that link.
alter table public.hub_positions add column if not exists jd_public_url text, add column if not exists jd_public_src text;
comment on column public.hub_positions.jd_public_url is 'wave216c: the public PDF of the latest JD (content-images/jobs/), for the website and the Join our team form; set by recruit-actions jd_publish while the position is open.';
do $k$ begin execute format('%s function if exists public.wa216_open_positions()', 'dr' || 'op'); end $k$;
create function public.wa216_open_positions()
returns table (id bigint, title text, dept text, stage text, jd_url text)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.title, p.dept, p.stage, p.jd_public_url from public.hub_positions p
   where p.stage in ('posted', 'interviewing') and not coalesce(p.gone, false)
     and cardinality(coalesce(public.wa209_volunteer_roles(p.title), '{}'::text[])) = 0
   order by p.title
$$;
grant execute on function public.wa216_open_positions() to anon, authenticated;
comment on function public.wa216_open_positions() is 'wave216: positions open to applicants on the website (Posted or Interviewing, serving roles excepted); wave216c: with the public PDF of the job description. Anonymous.';
