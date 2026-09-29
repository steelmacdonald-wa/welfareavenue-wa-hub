-- wa165c_ask_rank (29/09/26): Ask the Hub finds the meeting a question is about, not the one that says "start" most (wave165).
-- With 73 more meetings in the archive, common words (start, team, meeting, train) drowned the word that matters: "When did we
-- start the Keela training?" put the Keela training meeting fourth. Each word of the question now counts by how rare it is
-- among the meetings (a rare word like Keela says far more than "start"), a word in a meeting's title counts double, and the
-- passage shown is the one around the rarest words. Still run as the asker: only the meetings they may read.
create or replace function public.wa_ask_meetings(q text, lim integer default 8)
 returns table(id bigint, department text, title text, meeting_date date, visibility text, archive_only boolean, board_only boolean, ai_summary text, passage text, rank real)
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare v_n numeric; v_w text[]; v_idf numeric[]; v_all tsquery; v_top tsquery;
begin
  if not public.is_wa_staff() then return; end if;
  select count(*) into v_n from public.transcripts;
  -- the question's words (stemmed, no stop words), rarest first, each with its rarity among the meetings
  select array_agg(x.w order by x.idf desc, x.w), array_agg(x.idf order by x.idf desc, x.w) into v_w, v_idf
    from (select b.w, ln((v_n + 1.0) / (b.df + 1.0)) as idf
          from (select a.w, (select count(*) from public.transcripts t2 where t2.fts @@ quote_literal(a.w)::tsquery)::int as df
                from (select distinct regexp_replace(u.lexeme, '[^[:alnum:]]', '', 'g') as w
                      from unnest(to_tsvector('english', left(coalesce(q, ''), 1000))) as u(lexeme, positions, weights)) a
                where length(a.w) >= 2) b
          where b.df > 0) x;
  if v_w is null then return; end if;
  v_all := (select string_agg(quote_literal(w), ' | ') from unnest(v_w) w)::tsquery;
  v_top := (select string_agg(quote_literal(w), ' | ') from unnest(v_w[1:3]) w)::tsquery;
  return query
    with wd as (select z.w, z.idf from unnest(v_w, v_idf) as z(w, idf)),
    scored as (
      select t.id as tid, sum(wd.idf * case when to_tsvector('english', coalesce(t.title, '')) @@ quote_literal(wd.w)::tsquery then 2.0 else 1.0 end) as score
      from public.transcripts t join wd on t.fts @@ quote_literal(wd.w)::tsquery
      where ((not t.board_only) or public.is_board_circle())
        and public.wa_sees_restricted(t.visibility, t.allowed_people, t.added_by)
      group by t.id
      order by 2 desc
      limit greatest(1, least(coalesce(lim, 8), 20))
    )
    select t.id, t.department, t.title, t.meeting_date, coalesce(nullif(t.visibility, ''), 'department'), t.archive_only, t.board_only, t.ai_summary,
      ts_headline('english', left(t.body, 80000), coalesce(v_top, v_all), 'MaxWords=45, MinWords=18, MaxFragments=2, FragmentDelimiter=" ... "'),
      s.score::real
    from scored s join public.transcripts t on t.id = s.tid
    order by s.score desc, t.meeting_date desc nulls last;
end $function$;
revoke all on function public.wa_ask_meetings(text, integer) from public, anon;
grant execute on function public.wa_ask_meetings(text, integer) to authenticated;
comment on function public.wa_ask_meetings(text, integer) is 'wave165: Ask the Hub''s meeting search, run as the asker: each word of the question counts by its rarity among the meetings (a word in the title counts double), with the passage around the rarest words; only what the asker may read (wa_sees_restricted, board_only).';
