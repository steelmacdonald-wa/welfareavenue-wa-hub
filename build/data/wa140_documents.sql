-- wave140: the document finder (wa_documents) from the mining results. Re-runnable: it rebuilds every row from
-- mine.docs (documents read and kept), with the organisations and event titles found in each as search topics.
-- Visibility: documents from the board, management, HR, finance and leadership drives, and anything from Steel's own
-- drive or shared with him directly, are for leaders; the rest for all staff.
with d as (
  select x.*,
         nullif(substring(coalesce(x.doc_date, '') from '^(\d{4})'), '')::int as y1,
         extract(year from x.created_time)::int as y2
    from mine.docs x
), orgs as (
  select file_id, array_agg(distinct name order by name) filter (where name is not null and length(name) between 2 and 80 and name !~* '\m(ghd|jhd)\M') as names
    from mine.partners group by file_id
), tops as (
  select file_id, array_agg(distinct title order by title) filter (where title is not null) as titles
    from (select file_id, title from mine.events where happened <> 'planned' union all select file_id, topic from mine.lessons where topic is not null) t
   group by file_id
)
insert into public.wa_documents (file_id, title, summary, doc_date, year, kind, team, source, location, url, organisations, topics, reusable, resource_title, resource_what, visibility, updated_at)
select d.file_id,
       regexp_replace(regexp_replace(d.name, '\.(pdf|docx|doc|pptx|xlsx|txt)$', '', 'i'), '^(copy of |copie de )', '', 'i'),
       d.summary,
       d.doc_date,
       case when d.y1 between 2019 and 2027 then d.y1 when d.y2 between 2019 and 2027 then d.y2 end,
       case when d.doc_kind in ('posts', 'poster') then 'posts' when d.doc_kind = 'event' then 'report'
            when d.doc_kind in ('guide', 'plan', 'report', 'meeting notes', 'presentation', 'proposal', 'letter', 'newsletter', 'application', 'list') then d.doc_kind
            else 'other' end,
       case
         when d.source = 'social' then 'marketing'
         when d.drive_name = 'Marketing & Web' then 'marketing'
         when d.drive_name in ('Operations', 'Holiday gift drive ') then 'opsmtl'
         when d.drive_name in ('Toronto Branch', 'Former Toronto Drive') then 'opsto'
         when d.drive_name = 'Program Development' then 'progdev'
         when d.drive_name in ('Fundraising', 'Vanier', 'Accounting') then 'fundraising'
         when d.drive_name = 'Human Resources' then 'hr'
         when d.drive_name = 'Board of Directors' then 'board'
         when d.drive_name in ('Management', 'Steel & James') then 'leadership'
         when d.source = 'canva' then case when d.department ~* 'market' then 'marketing' when d.department ~* 'fund|sponsor' then 'fundraising' when d.department ~* 'hr|human' then 'hr' when d.department ~* 'oper' then 'opsmtl' when d.department ~* 'board' then 'board' else 'general' end
         else case when d.department ~* 'market' then 'marketing' when d.department ~* 'fund|sponsor|grant' then 'fundraising' when d.department ~* 'hr|human' then 'hr' when d.department ~* 'oper' then 'opsmtl' when d.department ~* 'board' then 'board' when d.department ~* 'program' then 'progdev' else 'general' end
       end,
       d.source,
       case d.source when 'canva' then 'Canva' when 'social' then 'Instagram, Facebook and LinkedIn' when 'my_drive' then 'My Drive (Steel)' when 'shared_with_me' then 'Shared with Steel' else coalesce(d.drive_name, 'Drive') end,
       d.web_url,
       coalesce(o.names, '{}'),
       coalesce((select array_agg(t) from unnest(tp.titles[1:25]) t), '{}'),
       coalesce(d.reusable and coalesce(d.still_useful, true) and ((d.resource_kind in ('guide', 'template', 'checklist', 'policy', 'script', 'form') and coalesce(d.doc_kind, '') <> 'meeting notes') or (d.resource_kind = 'deck' and d.doc_kind = 'presentation')), false),
       case when d.reusable then d.resource_title end,
       case when d.reusable then d.resource_what end,
       case when d.drive_name in ('Board of Directors', 'Management', 'Human Resources', 'Accounting', 'Steel & James') or d.source in ('my_drive', 'shared_with_me')
              or d.sensitivity in ('board', 'leadership', 'hr', 'donor', 'personal', 'transition') then 'leadership' else 'everyone' end,
       now()
  from d left join orgs o using (file_id) left join tops tp using (file_id)
 where d.source <> 'social'
on conflict (file_id) do update set title = excluded.title, summary = excluded.summary, doc_date = excluded.doc_date, year = excluded.year, kind = excluded.kind,
  team = excluded.team, source = excluded.source, location = excluded.location, url = excluded.url, organisations = excluded.organisations, topics = excluded.topics,
  reusable = excluded.reusable, resource_title = excluded.resource_title, resource_what = excluded.resource_what, visibility = excluded.visibility, updated_at = now();

-- a document found private after an earlier run leaves the finder
delete from public.wa_documents w where w.source = 'social' or not exists (select 1 from public.drive_mined m where m.file_id = w.file_id and m.stage = 'done');
