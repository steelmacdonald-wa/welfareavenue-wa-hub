-- wa165b_speakers_fix (29/09/26): four one-on-ones from the Loom backfill missed a person speaking in them (wave165).
-- Loom's transcript does not always name every voice: "Suhaib / Steel - April 14, 2026" named only Suhaib, "Ahmed / Shima / Steel -
-- August 17, 2026" only Ahmed and Shima, "Valex 1on1 - April 14, 2026" only Valex (Loom lists Valex and Steel on the meeting), and
-- "Ray / Steel - January 28, 2026" named nobody. loom-pull v2.1 adds the names a one-on-one's title joins, and when that still
-- leaves one person, the people Loom lists on the meeting (not its recorder); these four rows get the same people now.
-- Guarded: each row changes only while it is the archive-only one-on-one it was filed as.
create temp table w165b_fix (id bigint primary key, loom_id text not null, ap jsonb not null) on commit drop;
insert into w165b_fix (id, loom_id, ap) values
  (188, '47312ada110442d8acd48a962aee236d', '["Ray", "ray.mannie@welfareavenue.com", "Steel", "steel.macdonald@welfareavenue.com", "steelmacdonald@gmail.com"]'::jsonb),
  (205, '8514f1fa718d4595804234b521de0984', '["Suhaib", "suhaib.abdillahi@welfareavenue.com", "Steel", "steel.macdonald@welfareavenue.com", "steelmacdonald@gmail.com"]'::jsonb),
  (207, '6a9ae4f8ebbb41a082485d7320306731', '["Valex", "valex.sanon@welfareavenue.com", "Steel", "steel.macdonald@welfareavenue.com", "steelmacdonald@gmail.com"]'::jsonb),
  (236, '1330eda905984a2aa746d23a9c384e4c', '["Ahmed", "ahmedfakhir@welfareavenue.com", "Shima", "shima.butera@welfareavenue.com", "Steel", "steel.macdonald@welfareavenue.com", "steelmacdonald@gmail.com"]'::jsonb);
update public.transcripts t set allowed_people = f.ap
  from w165b_fix f where t.id = f.id and t.archive_only and t.visibility = 'speakers' and t.source_url ~ f.loom_id and t.allowed_people is distinct from f.ap;
update public.loom_videos v set allowed_people = f.ap, updated_at = now()
  from w165b_fix f where v.loom_id = f.loom_id and v.transcript_id = f.id and v.visibility = 'speakers' and v.allowed_people is distinct from f.ap;
update public.change_log c set allowed_people = f.ap
  from w165b_fix f where c.entity_type = 'loom' and c.entity_id = f.loom_id and c.visibility = 'speakers' and c.allowed_people is distinct from f.ap;
