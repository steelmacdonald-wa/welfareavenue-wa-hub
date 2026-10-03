-- wave195b (02/10/26): team and board members have a website account too, with the photo they have in the Hub.
-- Steel, 02/10/26: "I'd like for the team members to also sign into the website for an account there as well. Um, and allow
-- them to use the same photos and stuff that they have in the hub and Slack and all that to uh, eventually go on the team
-- page for their logos um, or their profile pictures." The Hub itself stays for the team and the board only (wave175b).
-- A team or board member's website session is their own sign-in (the access token hook gives them their usual role, not the
-- wa_volunteer claim); the account_* functions already accept it (wa175_hook_on: the volunteer claim, staff or board) and
-- read only the signed-in person's own record. account_me now also returns team: their roster name, title, team and photo
-- (team_members.avatar_url: their own upload on the Hub, else Slack, else Google Workspace, kept by directory-sync; only a
-- picture in the Hub's public avatars bucket), matched by their email or one of its aliases (wa_email_aliases). Board
-- viewers who are not on the roster get team with no name or photo.
-- account_me is patched in place, guarded by the md5 of the definition this migration was written against.
create or replace function pg_temp.wa_once(src text, a text, b text) returns text language plpgsql as $f$
begin
  if position(a in src) = 0 then raise exception 'account_me patch: text not found: %', left(a, 80); end if;
  if position(a in substr(src, position(a in src) + 1)) > 0 then raise exception 'account_me patch: text found twice: %', left(a, 80); end if;
  return replace(src, a, b);
end $f$;

do $do$
declare d text;
begin
  d := pg_get_functiondef('public.account_me(text)'::regprocedure);
  if md5(d) <> '360b1c9a3b238fea4418a901547e3c77' then raise exception 'account_me changed since wave195b was written (md5 %)', md5(d); end if;
  d := pg_temp.wa_once(d, $s$v_receipts jsonb; v_totals jsonb;$s$, $s$v_receipts jsonb; v_totals jsonb; v_team jsonb;$s$);
  d := pg_temp.wa_once(d, $s$    into u from auth.users x where x.id = v_uid;
$s$, $s$    into u from auth.users x where x.id = v_uid;
  -- wave195b: someone on the team or the board: their roster name, title, team and the photo they have in the Hub
  select jsonb_build_object('name', t.name, 'title', nullif(btrim(coalesce(t.role, '')), ''), 'department', t.department,
           'photo', case when coalesce(t.avatar_url, '') like 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/avatars/%' then t.avatar_url end)
    into v_team from public.team_members t
   where t.active is not false and (lower(btrim(t.email)) = u.email
      or exists (select 1 from public.wa_email_aliases a where lower(btrim(a.email)) = lower(btrim(t.email)) and u.email = any (select lower(btrim(x)) from unnest(a.aliases) x)))
   order by t.id limit 1;
  if v_team is null and (public.is_wa_staff() or public.is_board_viewer()) then
    v_team := jsonb_build_object('name', null, 'title', null, 'department', null, 'photo', null);
  end if;
$s$);
  d := pg_temp.wa_once(d, $s$'reason', case when u.email_confirmed_at is null then 'unverified' else 'taken' end);$s$,
                          $s$'reason', case when u.email_confirmed_at is null then 'unverified' else 'taken' end, 'team', v_team);$s$);
  d := pg_temp.wa_once(d, $s$'receipt_mode', coalesce((select value from public.app_config where key = 'receipt_mode'), 'off'));$s$,
                          $s$'receipt_mode', coalesce((select value from public.app_config where key = 'receipt_mode'), 'off'), 'team', v_team);$s$);
  execute d;
end $do$;
comment on function public.account_me(text) is 'wave194: the signed-in person''s profile on welfareavenue.com: their details, newsletter preference, whether they have a volunteer record (volunteer_me has the rest), their gifts with receipts and their official receipts. Connects the sign-in to its record the first time (account_link_user). Reads only the signed-in person''s own record. wave195b: team and board members too; for them team gives their roster name, title, team and the photo they have in the Hub (team_members.avatar_url, the public avatars bucket only).';
