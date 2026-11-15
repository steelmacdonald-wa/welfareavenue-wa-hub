-- 15/11/26 - wave351 release: a form on its own link (the count, or conversations), and the "Get help" list laid out properly.
-- One block: if any check fails, nothing changes. Made against the volunteer page da04d7fdd048f3bb80714b55245f20e8 (wave350). The Hub page is not touched.
-- Nobody is messaged. Undo: "15-11-26 - wave351 undo (only if needed).sql".
create table if not exists public.wa351_undo (k text primary key, v text, saved_at timestamptz default now());
alter table public.wa351_undo enable row level security;
revoke all on public.wa351_undo from anon, authenticated;
grant all on public.wa351_undo to service_role;
comment on table public.wa351_undo is 'wave351 (15/11/26): c/index.html as it was before wave351, for its undo. Drop after a week.';
do $pg$
declare c text; c_new text; n int; i int; o text; nw text;
  colds text[] := array[
  replace($co0$  function rpc(fn, body) {
    return fetch(API + fn,$co0$, chr(13), ''),
  replace($co1$  function token() {
    var m = location.pathname.match($co1$, chr(13), ''),
  replace($co2$  function paint() {
    if (S.d && S.d.survey && document.getElementById('svsend'))$co2$, chr(13), ''),
  replace($co3$  var tk = token();
  if (!tk) { notFound(); return; }
$co3$, chr(13), ''),
  replace($co4$  function notFound(msg) {
$co4$, chr(13), ''),
  replace($co5$st.textContent = '.tlyh{margin-top:14px;$co5$, chr(13), ''),
  replace($co6$st0.textContent = '.tlyh{margin-top:14px;$co6$, chr(13), '')];
  cnews text[] := array[
  replace($cn0$  function rpc(fn, body) {
    if (S.fl) { var m351 = linkRpc(fn, body); if (!m351) return Promise.resolve({ ok: true, body: null }); fn = m351[0]; body = m351[1]; }   /* wave351: a form on its own link */
    return fetch(API + fn,$cn0$, chr(13), ''),
  replace($cn1$  function token() {
    if (S.fl) return 'f-' + S.fl.code;   /* wave351 */
    var m = location.pathname.match($cn1$, chr(13), ''),
  replace($cn2$  function paint() {
    if (S.fl) { formPaint(); return; }   /* wave351 */
    if (S.d && S.d.survey && document.getElementById('svsend'))$cn2$, chr(13), ''),
  replace($cn3$  if (q.get('f')) { formBoot(String(q.get('f'))); return; }   /* wave351: a form on its own link */
  var tk = token();
  if (!tk) { notFound(); return; }
$cn3$, chr(13), ''),
  replace($cn4$  /* =====================================================================
     wave351 (15/11/26): a form on its own link. Steel: "I need a link to the form itself please."
     hub.welfareavenue.com/c/?f=<code> opens one form (the count, or conversations) for one event, for whoever is handed the
     link: they type their first name and start. The same cards as on a lead's page; their calls go to pb_link_get / pb_link_add.
     ===================================================================== */
  function linkRpc(fn, body) {
    var c = S.fl.code;
    if (fn === 'pb_link_get') return [fn, body];
    if (fn === 'volunteer_tally_get' || fn === 'volunteer_talk_get') return ['pb_link_get', { p_code: c }];
    if (fn === 'volunteer_tally_add' || fn === 'volunteer_talk_add') return ['pb_link_add', { p_code: c, p_name: S.fl.name || '', p_rows: (body && body.p_rows) || [] }];
    return null;
  }
  function formBoot(code) {
    if (!/^[A-Za-z0-9]{10,40}$/.test(code)) { notFound(); return; }
    S.fl = { code: code, name: '', info: null }; S.test = false;
    try { S.fl.name = localStorage.getItem('wa351n') || ''; } catch (e) { /* fine */ }
    rpc('pb_link_get', { p_code: code }).then(function (r) {
      if (!r.ok || !r.body) { S.fl = null; notFound(r.ok ? undefined : t('offline')); return; }
      S.fl.info = r.body; S.d = { first: '', role: '' };
      app.addEventListener('input', function (e) { if (e.target && e.target.id === 'flName' && S.fl) { S.fl.name = String(e.target.value || '').slice(0, 40); try { localStorage.setItem('wa351n', S.fl.name); } catch (z) { /* fine */ } } });
      paint();
      if (r.body.kind === 'count') tallyLoad(); else talkLoad();
    }).catch(function () { S.fl = null; notFound(t('offline')); });
  }
  function formPaint() {
    langButtons(); footer();
    var ey = document.getElementById('ey'); if (ey) ey.textContent = 'Welfare Avenue';
    var I = (S.fl && S.fl.info) || {}, fr = S.lang === 'fr';
    var nmEl = document.getElementById('flName'), had = !!(nmEl && document.activeElement === nmEl); if (nmEl) S.fl.name = String(nmEl.value || '').slice(0, 40);
    var body = I.kind === 'count' ? tallyHtml() : talkHtml();
    var dayTxt = ''; try { dayTxt = I.day ? day(I.day) : ''; } catch (e) { dayTxt = String(I.day || ''); }
    app.innerHTML = '<h2>' + E(I.kind === 'count' ? (fr ? 'Le décompte' : 'The count') : 'Conversations') + '</h2><div class="rule"></div>'
      + '<p style="margin:0 0 4px">' + E(dayTxt) + (I.city ? ' · ' + E(I.city) : '') + '</p>'
      + '<label for="flName" style="display:block;font-weight:700;font-size:15px;margin:16px 0 6px">' + E(fr ? 'Votre prénom' : 'Your first name') + '</label>'
      + '<input id="flName" type="text" maxlength="40" autocomplete="given-name" value="' + E(S.fl.name || '') + '" placeholder="' + E(fr ? 'Pour savoir qui a noté quoi' : 'So we know who noted what') + '" style="display:block;width:100%;box-sizing:border-box;min-height:48px;padding:10px 12px;border:1px solid rgba(16,63,57,.3);border-radius:12px;background:#fff;font:inherit;font-size:16px;color:#1F201E">'
      + (body || '<p style="margin-top:16px">' + E(fr ? 'Ce formulaire ouvre une heure avant le service et ferme six heures après le début.' : 'This form opens one hour before the serving and closes six hours after it starts.') + '</p>');
    if (had) { var n2 = document.getElementById('flName'); if (n2) { n2.focus(); try { n2.setSelectionRange(n2.value.length, n2.value.length); } catch (e2) { /* fine */ } } }
  }
  function notFound(msg) {
$cn4$, chr(13), ''),
  replace($cn5$st.textContent = '.tly .tlyh .m{display:flex;flex-wrap:nowrap;align-items:center;justify-content:space-between;gap:12px}.tly .tlyh .m > span{display:block;flex:1 1 auto;min-width:0;width:auto;overflow-wrap:break-word;word-break:normal;text-align:left}.tly .tlyh .m > button{display:inline-block;flex:0 0 auto;width:auto;max-width:58%;margin:0;white-space:nowrap}.tly .tlyh .m > i{flex:0 0 auto;width:auto}.tly .tlyh .lk{display:inline-block;width:auto;margin:0;text-align:left}.tly .tlyh{text-align:left}.tlyh{margin-top:14px;$cn5$, chr(13), ''),
  replace($cn6$st0.textContent = '.tly .tlyh .m{display:flex;flex-wrap:nowrap;align-items:center;justify-content:space-between;gap:12px}.tly .tlyh .m > span{display:block;flex:1 1 auto;min-width:0;width:auto;overflow-wrap:break-word;word-break:normal;text-align:left}.tly .tlyh .m > button{display:inline-block;flex:0 0 auto;width:auto;max-width:58%;margin:0;white-space:nowrap}.tly .tlyh .m > i{flex:0 0 auto;width:auto}.tly .tlyh .lk{display:inline-block;width:auto;margin:0;text-align:left}.tly .tlyh{text-align:left}.tlyh{margin-top:14px;$cn6$, chr(13), '')];
begin
  select content into c from public.site_files where path = 'c/index.html' and part = 1;
  if c is null or (select count(*) from public.site_files where path = 'c/index.html') <> 1 then raise exception 'c/index.html is not as expected'; end if;
  if md5(c) <> 'da04d7fdd048f3bb80714b55245f20e8' then raise exception 'c/index.html has moved since this file was made (md5 %)', md5(c); end if;
  insert into public.wa351_undo (k, v) values ('c/index.html', c) on conflict (k) do nothing;
  execute $db351$
-- wave351 database part: a form on its own link (the count, or conversations), for one event, for anyone who is handed the link.

create table if not exists public.pb_form_links (code text primary key, event_id bigint not null references public.volunteer_events(id) on delete cascade,
  form text not null check (form in ('count', 'talk')), created_at timestamptz not null default now(), created_by text, unique (event_id, form));
alter table public.pb_form_links enable row level security;
revoke all on public.pb_form_links from anon, authenticated;
grant all on public.pb_form_links to service_role;
comment on table public.pb_form_links is 'wave351: one open link per event and form (hub.welfareavenue.com/c/?f=code). Anyone with the link can add to that event''s count or conversations while the forms are open. Made through pb_links_for.';
alter table public.pb_tally add column if not exists link_code text;
alter table public.pb_conversations add column if not exists link_code text;
create unique index if not exists pb_tally_link_client on public.pb_tally (link_code, client_id) where link_code is not null and client_id is not null;
create unique index if not exists pb_conversations_link_client on public.pb_conversations (link_code, client_id) where link_code is not null and client_id is not null;

create or replace function public.pb_links_for(p_event bigint) returns jsonb language plpgsql security definer set search_path to '' as $f$
declare v_who text := lower(coalesce(auth.jwt()->>'email', 'staff')); f text;
begin
  if not coalesce(public.is_wa_staff(), false) then raise exception 'Staff only'; end if;
  if not exists (select 1 from public.volunteer_events where id = p_event) then raise exception 'No such event.'; end if;
  foreach f in array array['count', 'talk'] loop
    insert into public.pb_form_links (code, event_id, form, created_by) values (replace(gen_random_uuid()::text, '-', ''), p_event, f, v_who) on conflict (event_id, form) do nothing;
  end loop;
  return (select jsonb_object_agg(l.form, 'https://hub.welfareavenue.com/c/?f=' || l.code) from public.pb_form_links l where l.event_id = p_event);
end $f$;
revoke all on function public.pb_links_for(bigint) from public, anon;
grant execute on function public.pb_links_for(bigint) to authenticated, service_role;

create or replace function public.pb_link_get(p_code text) returns jsonb language plpgsql stable security definer set search_path to '' as $f$
declare l record;
begin
  if p_code is null or p_code !~ '^[A-Za-z0-9]{10,40}$' then return null; end if;
  select k.code, k.form, e.id as event_id, e.event_date, e.start_time, e.status, e.location into l
    from public.pb_form_links k join public.volunteer_events e on e.id = k.event_id where k.code = p_code;
  if not found or l.status = 'cancelled' then return null; end if;
  return jsonb_build_object('kind', l.form, 'open', public.wa298_tally_open(l.event_date, l.start_time), 'preview', false, 'mine', 0, 'mine_form', true, 'can_share', false, 'team', '[]'::jsonb,
    'count', case when l.form = 'count' then (select count(*) from public.pb_tally t where t.event_id = l.event_id) else (select count(*) from public.pb_conversations c where c.event_id = l.event_id) end,
    'form', public.pb_form_public(l.form), 'day', l.event_date, 'start', coalesce(l.start_time, '12:00'::time), 'city', public.wa298_city(l.location));
end $f$;
revoke all on function public.pb_link_get(text) from public;
grant execute on function public.pb_link_get(text) to anon, authenticated, service_role;

create or replace function public.pb_link_add(p_code text, p_name text, p_rows jsonb) returns jsonb language plpgsql security definer set search_path to '' as $f$
declare l record; x jsonb; f jsonb; v_form jsonb; v_ex jsonb; v_k text; v_ok text[]; v_note text; v_added int := 0; v_id bigint; v_n int;
        v_by text := coalesce(nullif(left(btrim(regexp_replace(coalesce(p_name, ''), '[^[:alnum:] ''.\-]', '', 'g')), 40), ''), 'Guest') || ' (link)';
begin
  if p_code is null or p_code !~ '^[A-Za-z0-9]{10,40}$' or p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 60 then return jsonb_build_object('ok', false, 'reason', 'bad'); end if;
  select k.code, k.form, e.id as event_id, e.event_date, e.start_time, e.status, e.location into l
    from public.pb_form_links k join public.volunteer_events e on e.id = k.event_id where k.code = p_code;
  if not found or l.status = 'cancelled' then return jsonb_build_object('ok', false); end if;
  if not public.wa298_tally_open(l.event_date, l.start_time) then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;
  v_form := public.pb_form_public(l.form);
  for x in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(x) <> 'object' or coalesce(x->>'cid', '') !~ '^[A-Za-z0-9_-]{4,40}$' then continue; end if;
    if coalesce(x->>'undo', '') = '1' then
      if l.form = 'count' then delete from public.pb_tally where link_code = l.code and client_id = x->>'cid';
      else delete from public.pb_conversations where link_code = l.code and client_id = x->>'cid'; end if;
      continue;
    end if;
    v_ex := null;
    if jsonb_typeof(x->(case when l.form = 'count' then 'ex' else 'a' end)) = 'object' then
      for f in select value from jsonb_array_elements(coalesce(v_form->'fields', '[]'::jsonb)) loop
        v_k := f->>'k';
        if (l.form = 'count' and v_k in ('age', 'sex', 'bg', 'meal')) or not (x->(case when l.form = 'count' then 'ex' else 'a' end)) ? v_k then continue; end if;
        select coalesce(array_agg(o->>0), '{}') into v_ok from jsonb_array_elements(f->'o') o;
        if coalesce((f->>'m')::boolean, false) and jsonb_typeof(x->(case when l.form = 'count' then 'ex' else 'a' end)->v_k) = 'array' then
          v_ex := coalesce(v_ex, '{}'::jsonb) || jsonb_build_object(v_k, (select coalesce(jsonb_agg(distinct t), '[]'::jsonb) from jsonb_array_elements_text(x->(case when l.form = 'count' then 'ex' else 'a' end)->v_k) t where t = any (v_ok)));
        elsif jsonb_typeof(x->(case when l.form = 'count' then 'ex' else 'a' end)->v_k) = 'string' and (x->(case when l.form = 'count' then 'ex' else 'a' end)->>v_k) = any (v_ok) then
          v_ex := coalesce(v_ex, '{}'::jsonb) || jsonb_build_object(v_k, x->(case when l.form = 'count' then 'ex' else 'a' end)->>v_k);
        end if;
      end loop;
    end if;
    if l.form = 'count' then
      if coalesce(x->>'age', 'unknown') not in ('child', 'youth', 'adult', 'senior', 'unknown') or coalesce(x->>'sex', 'unknown') not in ('man', 'woman', 'non_binary', 'unknown')
         or coalesce(x->>'bg', 'unknown') not in ('indigenous', 'non_indigenous', 'unknown') or coalesce(x->>'meal', 'standard') not in ('standard', 'special') then continue; end if;
      insert into public.pb_tally (event_id, served_on, city, age_group, sex, background, meal, source, roster_id, by_name, client_id, extra, link_code)
      values (l.event_id, l.event_date, public.wa298_city(l.location), coalesce(x->>'age', 'unknown'), coalesce(x->>'sex', 'unknown'), coalesce(x->>'bg', 'unknown'), coalesce(x->>'meal', 'standard'), 'hub', null, v_by, x->>'cid', v_ex, l.code)
      on conflict (link_code, client_id) where link_code is not null and client_id is not null do nothing returning id into v_id;
    else
      v_note := nullif(left(btrim(regexp_replace(coalesce(x->>'note', ''), '\s+', ' ', 'g')), 600), '');
      if coalesce(v_ex, '{}'::jsonb) = '{}'::jsonb and v_note is null then continue; end if;
      insert into public.pb_conversations (event_id, served_on, city, roster_id, by_name, client_id, answers, note, lang, link_code)
      values (l.event_id, l.event_date, public.wa298_city(l.location), null, v_by, x->>'cid', coalesce(v_ex, '{}'::jsonb), v_note, case when x->>'lang' in ('en', 'fr') then x->>'lang' end, l.code)
      on conflict (link_code, client_id) where link_code is not null and client_id is not null do nothing returning id into v_id;
    end if;
    if v_id is not null then v_added := v_added + 1; v_id := null; end if;
  end loop;
  if l.form = 'count' then select count(*) into v_n from public.pb_tally where event_id = l.event_id; else select count(*) into v_n from public.pb_conversations where event_id = l.event_id; end if;
  return jsonb_build_object('ok', true, 'added', v_added, 'count', v_n);
end $f$;
revoke all on function public.pb_link_add(text, text, jsonb) from public;
grant execute on function public.pb_link_add(text, text, jsonb) to anon, authenticated, service_role;

$db351$;
  c_new := c;
  for i in 1..array_length(colds, 1) loop
    o := colds[i]; nw := cnews[i]; n := (length(c_new) - length(replace(c_new, o, ''))) / length(o);
    if n <> 1 then raise exception 'c/index.html: edit % matches % times', i, n; end if;
    c_new := replace(c_new, o, nw);
  end loop;
  if md5(c_new) <> '264a878642b25da276e467ef53d41859' then raise exception 'c/index.html: unexpected result %', md5(c_new); end if;
  update public.site_files set content = c_new, updated_at = now() where path = 'c/index.html' and part = 1;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('release', 'c/index.html', 'wave351', md5(c), md5(c_new) || ': a form on its own link; the Get help list laid out properly', 'wave351');
end $pg$;
-- PUBLISH
select public.call_edge('host-sync', '{}'::jsonb) as host_sync;
