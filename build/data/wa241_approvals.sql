-- =====================================================================
-- wave241 (15/10/26): approvals in the Content Studio, the Canva link, LinkedIn articles, posts by partner
-- =====================================================================
-- Steel, 14/10/26 marketing meeting: "Robert schedules the posts, it goes to approval, and it's sent a message [...] to you
-- and KK, and it's like a button, you can literally just click a button to approve in Slack, or you can do it in the hub."
-- 1. content_posts.canva_url (the design in Canva) and content_posts.partner_id (wa_partners: posts by partner).
-- 2. hub_settings content_studio.approvers: the people pinged when a post waits (Ian and KK); empty means the marketing
--    leads and admins. wa241_approvers() reads it; wa225_publisher() also counts a listed approver as a publisher.
-- 3. wa225_post_guard: scheduling by someone who cannot publish is a submission (the post keeps its date, waits for an
--    approver, and goes out at that time once approved) instead of an error; the approvers are told at once.
-- 4. social-publish v4 (deployed apart): the pending DM goes to the approvers with Approve / Send it back links, names
--    the Canva design and a LinkedIn article. No row deleted.
-- =====================================================================

alter table public.content_posts add column if not exists canva_url text;
alter table public.content_posts add column if not exists partner_id bigint;
create index if not exists content_posts_partner_idx on public.content_posts (partner_id) where partner_id is not null;
comment on column public.content_posts.canva_url is 'wave241: the design in Canva (a link; the approvers see it)';
comment on column public.content_posts.partner_id is 'wave241: the partner organization the post is about (wa_partners.id); Library > By partner';

-- who gets the approval pings: hub_settings content_studio.approvers (emails), else the marketing leads and admins
create or replace function public.wa241_approvers()
returns text[] language sql stable security definer set search_path to '' as $$
  with s as (
    select coalesce((select array_agg(lower(btrim(x))) from jsonb_array_elements_text(coalesce((select value -> 'approvers' from public.hub_settings where key = 'content_studio'), '[]'::jsonb)) x where x ~ '@'), '{}'::text[]) as listed)
  select case when cardinality(s.listed) > 0 then s.listed
              else coalesce((select array_agg(distinct lower(r.email)) from public.hub_roles r
                              where r.role = 'admin'
                                 or (r.role = 'leader' and (r.profile = 'marketing' or exists (select 1 from public.team_members t where lower(t.email) = lower(r.email) and t.active and t.department = 'marketing')))), '{}'::text[]) end
    from s;
$$;

-- a listed approver publishes and approves too
create or replace function public.wa225_publisher()
returns boolean language sql stable security definer set search_path to '' as $$
  select public.is_wa_staff() and (
    exists (select 1 from public.hub_roles r where r.email = public.wa_email() and r.role = 'admin')
    or (exists (select 1 from public.hub_roles r where r.email = public.wa_email() and r.role = 'leader') and public.wa225_marketing())
    or public.wa_email() = any (public.wa241_approvers()));   -- wave241: the named approvers
$$;

-- scheduling by someone who cannot publish is a submission, not an error
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'wa225_post_guard';
  if position('wave241' in d) > 0 then return; end if;
  d := replace(d, $a$    raise exception 'needs approval: a marketing lead or an admin approves this post before it is scheduled' using errcode = '42501';
  end if;$a$,
$s$    if new.status = 'scheduled' and tg_op in ('INSERT', 'UPDATE') then
      -- wave241: the post keeps its date and waits for an approver; once approved it is scheduled for that time
      new.status := 'draft'; new.approval_status := 'pending';
      new.submitted_by := coalesce(nullif(public.wa_email(), ''), new.updated_by, case when tg_op = 'UPDATE' then old.submitted_by end); new.submitted_at := now();
      if coalesce((select value from public.app_config where key = 'studio_notify'), 'on') <> 'off' then
        begin perform public.call_edge('social-publish', jsonb_build_object('action', 'approval_notify', 'post_id', new.id, 'state', 'pending')); exception when others then null; end;
      end if;
    else
      raise exception 'needs approval: an approver, a marketing lead or an admin approves this post before it goes out' using errcode = '42501';
    end if;
  end if;$s$);
  if position('wave241' in d) = 0 then raise exception 'wa225_post_guard: the anchor was not found'; end if;
  execute d;
end $$;

-- the approvers Steel named: Ian and KK
update public.hub_settings set value = coalesce(value, '{}'::jsonb) || '{"approvers": ["ian.odhiambo@welfareavenue.com", "kahkashan.ansary@welfareavenue.com"]}'::jsonb, updated_at = now(), updated_by = 'wave241'
 where key = 'content_studio' and not (coalesce(value, '{}'::jsonb) ? 'approvers');

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
values ('hub', 'release', 'wave241', null,
        'Content Studio approvals: scheduling by anyone who cannot publish sends the post for approval and keeps its date; the approvers (Ian and KK, content_studio.approvers) are pinged with Approve and Send it back links; a Canva design link and a partner organization on each post; LinkedIn articles; Library > By partner',
        'assistant');
