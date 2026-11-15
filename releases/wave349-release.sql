-- 15/11/26 - wave349 release: the person with the count can give it to confirmed teammates, from their own page ("Get help counting").
-- One block: if any check fails, nothing changes. Made against the volunteer page 35ff7b95271996764d78e75667256547 (wave347). The Hub page is not touched.
-- Nobody is messaged. Undo: "15-11-26 - wave349 undo (only if needed).sql".
create table if not exists public.wa349_undo (k text primary key, v text, saved_at timestamptz default now());
alter table public.wa349_undo enable row level security;
revoke all on public.wa349_undo from anon, authenticated;
grant all on public.wa349_undo to service_role;
comment on table public.wa349_undo is 'wave349 (15/11/26): c/index.html and two count functions as they were before wave349, for its undo. Drop after a week.';
do $pg$
declare c text; c_new text; n int; i int; o text; nw text;
  colds text[] := array[
  replace($co0$      + '<p class="st">' + (q.length ? q.length + ' ' + E(tt('wait')) : E(tt('saved'))) + '</p></div>';
  }$co0$, chr(13), ''),
  replace($co1$  function tallyShow() { return !!(S.tal && (S.tal.open || S.test)); }$co1$, chr(13), ''),
  replace($co2$if (b.hasAttribute('data-tly')) { var k = b.getAttribute('data-tly'), v = b.getAttribute('data-v'); if (b.hasAttribute('data-m'))$co2$, chr(13), ''),
  replace($co3$var b = e.target && e.target.closest ? e.target.closest('[data-tly],[data-tlyadd],[data-tlyundo]') : null; if (!b) return;$co3$, chr(13), '')];
  cnews text[] := array[
  replace($cn0$      + '<p class="st">' + (q.length ? q.length + ' ' + E(tt('wait')) : E(tt('saved'))) + '</p>' + shareHtml() + '</div>';   /* wave349 */
  }$cn0$, chr(13), ''),
  replace($cn1$  function tallyShow() { return !!(S.tal && (S.tal.open || S.test)); }
  /* wave349: the counter can give the count to confirmed teammates; it then shows on their own page (volunteer_tally_share) */
  function shareHtml() {
    var T = S.tal || {}, team = T.team || []; if (!T.can_share || !team.length) return '';
    var fr = S.lang === 'fr';
    if (!document.getElementById('tlyhcss')) { var st = document.createElement('style'); st.id = 'tlyhcss';
      st.textContent = '.tlyh{margin-top:14px;padding-top:12px;border-top:1px solid rgba(16,63,57,.14)}.tlyh .lk{border:0;background:none;padding:10px 0;min-height:44px;font:inherit;font-weight:700;font-size:15px;color:#103F39;text-decoration:underline;text-underline-offset:3px;cursor:pointer;touch-action:manipulation}.tlyh .hn{margin:2px 0 10px;font-size:14px;line-height:1.45;color:#585B57}.tlyh .m{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid rgba(16,63,57,.08)}.tlyh .m span{min-width:0;overflow-wrap:anywhere;font-size:15px;font-weight:700}.tlyh .m small{display:block;font-size:12.5px;font-weight:400;color:#585B57}.tlyh .m button{flex:none;min-height:44px;padding:0 14px;border-radius:999px;border:1px solid rgba(16,63,57,.3);background:#fff;font:inherit;font-size:14px;font-weight:700;color:#103F39;cursor:pointer;touch-action:manipulation}.tlyh .m button.on{background:#103F39;color:#fff;border-color:#103F39}.tlyh .m i{font-style:normal;font-size:12.5px;color:#585B57;flex:none}.tlyh .er{color:#B3402F;font-size:14px;margin:6px 0}';
      document.head.appendChild(st); }
    var h = '<div class="tlyh"><button type="button" class="lk" data-tlyshow="1" aria-expanded="' + (S.tsh ? 'true' : 'false') + '">' + E(fr ? 'Obtenir de l\u2019aide pour compter' : 'Get help counting') + (S.tsh ? ' \u25b4' : ' \u25be') + '</button>';
    if (S.tsh) {
      h += '<p class="hn">' + E(fr ? 'Donnez le d\u00e9compte \u00e0 une co\u00e9quipi\u00e8re ou un co\u00e9quipier : il appara\u00eet sur sa propre page Welfare Avenue (le lien de sa confirmation). Si sa page est d\u00e9j\u00e0 ouverte, il faut la recharger. Entendez-vous sur qui compte quelle file, pour ne compter personne deux fois.'
        : 'Give the count to a teammate: it shows on their own Welfare Avenue page (the link from their confirmation). If their page is already open, they reload it. Agree who counts which line, so nobody is counted twice.') + '</p>'
        + (S.tshe ? '<p class="er" role="alert">' + E(S.tshe) + '</p>' : '')
        + team.map(function (m) {
          var who = '<span>' + E(m.name || '') + '<small>' + E((fr && m.role_fr) || m.role_en || '') + '</small></span>';
          if (m.fixed) return '<div class="m">' + who + '<i>' + E(fr ? 'Compte d\u00e9j\u00e0' : 'Already counting') + '</i></div>';
          return '<div class="m">' + who + '<button type="button" data-tlysh="' + E(m.rid) + '" data-on="' + (m.on ? '1' : '0') + '" aria-pressed="' + (m.on ? 'true' : 'false') + '"' + (m.on ? ' class="on"' : '') + (S.tshb ? ' disabled' : '') + '>'
            + E(m.on ? (fr ? 'A le d\u00e9compte \u2713' : 'Has the count \u2713') : (fr ? 'Donner le d\u00e9compte' : 'Give the count')) + '</button></div>';
        }).join('');
    }
    return h + '</div>';
  }
  function tallyShare(b) {
    if (S.tshb) return;
    var rid = Number(b.getAttribute('data-tlysh')), on = b.getAttribute('data-on') !== '1', fr = S.lang === 'fr';
    S.tshe = '';
    if (S.test) { S.tshe = fr ? 'Aper\u00e7u : rien n\u2019est enregistr\u00e9.' : 'Preview: nothing is saved.'; paint(); return; }
    S.tshb = true; paint();
    rpc('volunteer_tally_share', { p_token: token(), p_roster: rid, p_on: on }).then(function (r) {
      S.tshb = false;
      if (r.ok && r.body && r.body.ok) S.tal.team = r.body.team || [];
      else S.tshe = fr ? 'Cela n\u2019a pas fonctionn\u00e9. V\u00e9rifiez la connexion et r\u00e9essayez.' : 'That did not go through. Check the connection and try again.';
      paint();
    }).catch(function () { S.tshb = false; S.tshe = fr ? 'Pas de connexion. R\u00e9essayez.' : 'No connection. Try again.'; paint(); });
  }$cn1$, chr(13), ''),
  replace($cn2$if (b.hasAttribute('data-tlyshow')) { S.tsh = !S.tsh; S.tshe = ''; paint(); return; }
          if (b.hasAttribute('data-tlysh')) { tallyShare(b); return; }   /* wave349 */
          if (b.hasAttribute('data-tly')) { var k = b.getAttribute('data-tly'), v = b.getAttribute('data-v'); if (b.hasAttribute('data-m'))$cn2$, chr(13), ''),
  replace($cn3$var b = e.target && e.target.closest ? e.target.closest('[data-tly],[data-tlyadd],[data-tlyundo],[data-tlyshow],[data-tlysh]') : null; if (!b) return;$cn3$, chr(13), '')];
begin
  select content into c from public.site_files where path = 'c/index.html' and part = 1;
  if c is null or (select count(*) from public.site_files where path = 'c/index.html') <> 1 then raise exception 'c/index.html is not as expected'; end if;
  if md5(c) <> '35ff7b95271996764d78e75667256547' then raise exception 'c/index.html has moved since this file was made (md5 %)', md5(c); end if;
  insert into public.wa349_undo (k, v) values ('c/index.html', c) on conflict (k) do nothing;
  insert into public.wa349_undo (k, v) select p.proname, pg_get_functiondef(p.oid) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('volunteer_tally_get', 'pb_may_count') on conflict (k) do nothing;
  if (select count(*) from public.wa349_undo) <> 3 then raise exception 'could not save what the undo needs'; end if;
  execute $db349$
-- wave349 database part: the person with the count can give it to confirmed teammates, from their own page.

create or replace function public.pb_may_count(p_roster bigint) returns boolean language sql stable security definer set search_path to '' as $f$
  select case when lower(coalesce(r.role, '')) = 'team_leader' or coalesce(r.detail->>'cl_job', '') = 'count' or coalesce(r.detail->>'count_help', '') = 'true' then true
              when exists (select 1 from public.event_roster x where x.event_id = r.event_id and coalesce(x.detail->>'cl_job', '') = 'count'
                             and lower(coalesce(x.status, '')) not in ('cancelled', 'unavailable') and coalesce(x.confirm_status, '') <> 'declined') then false
              else lower(coalesce(r.role, '')) in ('community_debrief', 'community_talker') end
  from public.event_roster r where r.id = p_roster
$f$;

-- who may hand the count on: the team leader, a community lead, the person given The count. A helper cannot pass it further.
create or replace function public.pb_can_share_count(p_roster bigint) returns boolean language sql stable security definer set search_path to '' as $f$
  select coalesce(public.pb_may_count(r.id), false) and (lower(coalesce(r.role, '')) in ('team_leader', 'community_debrief', 'community_talker') or coalesce(r.detail->>'cl_job', '') = 'count')
  from public.event_roster r where r.id = p_roster
$f$;
revoke all on function public.pb_can_share_count(bigint) from public, anon, authenticated;
grant execute on function public.pb_can_share_count(bigint) to service_role;

-- the confirmed teammates on the same event, as the counter's page lists them (first name and last initial only)
create or replace function public.pb_count_team(p_roster bigint) returns jsonb language sql stable security definer set search_path to '' as $f$
  select coalesce(jsonb_agg(jsonb_build_object('rid', t.id,
           'name', split_part(btrim(t.person_name), ' ', 1) || case when position(' ' in btrim(t.person_name)) > 0 then ' ' || left(split_part(btrim(t.person_name), ' ', array_length(string_to_array(btrim(t.person_name), ' '), 1)), 1) || '.' else '' end,
           'role_en', public.wa171_role_label(t.role, 'en'), 'role_fr', public.wa171_role_label(t.role, 'fr'),
           'on', coalesce(t.detail->>'count_help', '') = 'true',
           'fixed', lower(coalesce(t.role, '')) = 'team_leader' or coalesce(t.detail->>'cl_job', '') = 'count')
         order by case lower(t.role) when 'community_debrief' then 0 when 'server' then 1 when 'team_leader' then 2 else 3 end, t.person_name), '[]'::jsonb)
    from public.event_roster me join public.event_roster t on t.event_id = me.event_id and t.id <> me.id
   where me.id = p_roster and lower(coalesce(t.status, '')) like 'confirm%' and coalesce(t.confirm_status, '') <> 'declined' and t.confirm_token is not null
$f$;
revoke all on function public.pb_count_team(bigint) from public, anon, authenticated;
grant execute on function public.pb_count_team(bigint) to service_role;

create or replace function public.volunteer_tally_get(p_token text, p_preview boolean default false) returns jsonb
language plpgsql security definer set search_path to '' as $function$
declare r record; v_n int; v_mine int;
begin
  if p_token is null or length(p_token) < 12 then return null; end if;
  select er.id, lower(coalesce(er.role, '')) as role, er.status, er.confirm_status, er.event_id, e.event_date, e.status as ev_status, e.start_time, e.location into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.confirm_token = p_token;
  if not found or not coalesce(public.pb_may_count(r.id), false) then return null; end if;
  if r.ev_status = 'cancelled' or lower(coalesce(r.status, '')) in ('cancelled', 'unavailable') or r.confirm_status = 'declined' then return null; end if;
  select count(*), count(*) filter (where roster_id = r.id) into v_n, v_mine from public.pb_tally where event_id = r.event_id;
  return jsonb_build_object('open', public.wa298_tally_open(r.event_date, r.start_time), 'preview', coalesce(p_preview, false),
    'day', r.event_date, 'start', coalesce(r.start_time, '12:00'::time), 'count', v_n, 'mine', v_mine, 'city', public.wa298_city(r.location),
    'form', public.pb_form_public('count'),   -- wave347: the questions, as the Program Builder has them
    'can_share', public.pb_can_share_count(r.id), 'team', case when public.pb_can_share_count(r.id) then public.pb_count_team(r.id) else '[]'::jsonb end);   -- wave349: the counter can give the count to teammates
end $function$;


create or replace function public.volunteer_tally_share(p_token text, p_roster bigint, p_on boolean) returns jsonb
language plpgsql security definer set search_path to '' as $function$
declare r record; t record;
begin
  if p_token is null or length(p_token) < 12 or p_roster is null then return jsonb_build_object('ok', false, 'reason', 'bad'); end if;
  select er.id, er.event_id, er.person_name, er.status, er.confirm_status, e.status as ev_status into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.confirm_token = p_token;
  if not found or r.ev_status = 'cancelled' or lower(coalesce(r.status, '')) in ('cancelled', 'unavailable') or r.confirm_status = 'declined'
     or not coalesce(public.pb_can_share_count(r.id), false) then return jsonb_build_object('ok', false, 'reason', 'not_yours'); end if;
  select x.id, x.status, x.confirm_status, x.detail into t from public.event_roster x where x.id = p_roster and x.event_id = r.event_id and x.id <> r.id;
  if not found or lower(coalesce(t.status, '')) not like 'confirm%' or coalesce(t.confirm_status, '') = 'declined' then return jsonb_build_object('ok', false, 'reason', 'not_confirmed'); end if;
  if coalesce(p_on, false) then
    update public.event_roster set detail = coalesce(detail, '{}'::jsonb) || jsonb_build_object('count_help', 'true', 'count_help_by', r.person_name, 'count_help_at', now()) where id = t.id;
  else
    update public.event_roster set detail = coalesce(detail, '{}'::jsonb) - 'count_help' - 'count_help_by' - 'count_help_at' where id = t.id;
  end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('event_roster', t.id::text, 'count_help', null, case when coalesce(p_on, false) then 'given the count by ' else 'the count taken back by ' end || coalesce(r.person_name, 'the counter'), 'volunteer page');
  return jsonb_build_object('ok', true, 'team', public.pb_count_team(r.id));
end $function$;
revoke all on function public.volunteer_tally_share(text, bigint, boolean) from public;
grant execute on function public.volunteer_tally_share(text, bigint, boolean) to anon, authenticated, service_role;

$db349$;
  c_new := c;
  for i in 1..array_length(colds, 1) loop
    o := colds[i]; nw := cnews[i]; n := (length(c_new) - length(replace(c_new, o, ''))) / length(o);
    if n <> 1 then raise exception 'c/index.html: edit % matches % times', i, n; end if;
    c_new := replace(c_new, o, nw);
  end loop;
  if md5(c_new) <> 'ec050f8139c1db231d19a6e16085930b' then raise exception 'c/index.html: unexpected result %', md5(c_new); end if;
  update public.site_files set content = c_new, updated_at = now() where path = 'c/index.html' and part = 1;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('release', 'c/index.html', 'wave349', md5(c), md5(c_new) || ': Get help counting (the counter gives the count to confirmed teammates)', 'wave349');
end $pg$;
-- PUBLISH
select public.call_edge('host-sync', '{}'::jsonb) as host_sync;
