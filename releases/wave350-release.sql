-- 15/11/26 - wave350 release: the conversations form on the lead's own page (one short record per conversation, no names).
-- One block: if any check fails, nothing changes. Made against the volunteer page ec050f8139c1db231d19a6e16085930b (wave349). The Hub page is not touched.
-- Nobody is messaged. Undo: "15-11-26 - wave350 undo (only if needed).sql".
create table if not exists public.wa350_undo (k text primary key, v text, saved_at timestamptz default now());
alter table public.wa350_undo enable row level security;
revoke all on public.wa350_undo from anon, authenticated;
grant all on public.wa350_undo to service_role;
comment on table public.wa350_undo is 'wave350 (15/11/26): c/index.html as it was before wave350, for its undo. Drop after a week.';
do $pg$
declare c text; c_new text; n int; i int; o text; nw text;
  colds text[] := array[
  replace($co0$  function tallyShow() { return !!(S.tal && (S.tal.open || S.test)); }$co0$, chr(13), ''),
  replace($co1$spotHtml() + tallyHtml() + invHtml()
        + (d.survey ? surveyHtml() :$co1$, chr(13), ''),
  replace($co2$spotHtml() + tallyHtml() + invHtml() + surveyHtml() + teaserHtml()$co2$, chr(13), ''),
  replace($co3$+ teaserHtml() + tallyHtml() + (S.inv && S.inv.open ? invHtml() : '')$co3$, chr(13), ''),
  replace($co4$    invLoad(); tallyLoad();
$co4$, chr(13), '')];
  cnews text[] := array[
  replace($cn0$  function tallyShow() { return !!(S.tal && (S.tal.open || S.test)); }

  /* =====================================================================
     wave350 (15/11/26): the conversations form. Steel: "I'd like a survey page for the conversations too."
     One short record per conversation with a person we serve, no names: the taps come from the Program Builder's
     "talk" form (volunteer_talk_get), a note can be typed or dictated, taps wait on the phone when offline
     (volunteer_talk_add). A lead can give the form to confirmed teammates (volunteer_talk_share).
     ===================================================================== */
  function kKey() { return 'wa350q:' + token(); }
  function kQueue() { try { return JSON.parse(localStorage.getItem(kKey()) || '[]') || []; } catch (e) { return S.kq || []; } }
  function kSave(q) { S.kq = q; try { localStorage.setItem(kKey(), JSON.stringify(q)); } catch (e) { /* in memory then */ } }
  function talkShow() { return !!(S.tk && (S.tk.open || S.test) && (S.tk.mine_form || S.tk.can_share)); }
  function kForm() { var f = S.tk && S.tk.form; return f && f.fields ? f.fields : []; }
  function kSR() { try { return window.SpeechRecognition || window.webkitSpeechRecognition || null; } catch (e) { return null; } }
  function rowK(f) {
    var p = S.kp || {}, fr = S.lang === 'fr', lab = (fr && f.fr) || f.en || f.k, cur = p[f.k];
    var short = (f.o || []).every(function (o) { return String(o[1] || '').length <= 2; });
    return '<div class="w">' + E(lab) + '</div><div class="row' + (short ? ' r5' : '') + '" role="group" aria-label="' + E(lab) + '">' + (f.o || []).map(function (o) {
      var on = f.m ? (Array.isArray(cur) && cur.indexOf(o[0]) >= 0) : cur === o[0];
      return '<button type="button" data-tk="' + E(f.k) + '" data-v="' + E(o[0]) + '"' + (f.m ? ' data-m="1"' : '') + ' aria-pressed="' + (on ? 'true' : 'false') + '"' + (on ? ' class="on"' : '') + '>' + E((fr && o[2]) || o[1] || o[0]) + '</button>';
    }).join('') + '</div>';
  }
  function shareK() {
    var T = S.tk || {}, team = T.team || []; if (!T.can_share || !team.length) return '';
    var fr = S.lang === 'fr';
    var h = '<div class="tlyh"><button type="button" class="lk" data-tkshow="1" aria-expanded="' + (S.ksh ? 'true' : 'false') + '">' + E(fr ? 'Obtenir de l’aide pour les conversations' : 'Get help with conversations') + (S.ksh ? ' ▴' : ' ▾') + '</button>';
    if (S.ksh) {
      h += '<p class="hn">' + E(fr ? 'Donnez ce formulaire à une coéquipière ou un coéquipier : il apparaît sur sa propre page Welfare Avenue (le lien de sa confirmation). Si sa page est déjà ouverte, il faut la recharger.'
        : 'Give this form to a teammate: it shows on their own Welfare Avenue page (the link from their confirmation). If their page is already open, they reload it.') + '</p>'
        + (S.kshe ? '<p class="er" role="alert">' + E(S.kshe) + '</p>' : '')
        + team.map(function (m) {
          var who = '<span>' + E(m.name || '') + '<small>' + E((fr && m.role_fr) || m.role_en || '') + '</small></span>';
          if (m.fixed) return '<div class="m">' + who + '<i>' + E(fr ? 'L’a déjà' : 'Already has it') + '</i></div>';
          return '<div class="m">' + who + '<button type="button" data-tksh="' + E(m.rid) + '" data-on="' + (m.on ? '1' : '0') + '" aria-pressed="' + (m.on ? 'true' : 'false') + '"' + (m.on ? ' class="on"' : '') + (S.kshb ? ' disabled' : '') + '>'
            + E(m.on ? (fr ? 'A le formulaire ✓' : 'Has the form ✓') : (fr ? 'Donner le formulaire' : 'Give the form')) + '</button></div>';
        }).join('');
    }
    return h + '</div>';
  }
  function talkHtml() {
    if (!talkShow()) return '';
    tallyCss();
    if (!document.getElementById('tlyhcss')) { var st0 = document.createElement('style'); st0.id = 'tlyhcss';
      st0.textContent = '.tlyh{margin-top:14px;padding-top:12px;border-top:1px solid rgba(16,63,57,.14)}.tlyh .lk{border:0;background:none;padding:10px 0;min-height:44px;font:inherit;font-weight:700;font-size:15px;color:#103F39;text-decoration:underline;text-underline-offset:3px;cursor:pointer;touch-action:manipulation}.tlyh .hn{margin:2px 0 10px;font-size:14px;line-height:1.45;color:#585B57}.tlyh .m{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid rgba(16,63,57,.08)}.tlyh .m span{min-width:0;overflow-wrap:anywhere;font-size:15px;font-weight:700}.tlyh .m small{display:block;font-size:12.5px;font-weight:400;color:#585B57}.tlyh .m button{flex:none;min-height:44px;padding:0 14px;border-radius:999px;border:1px solid rgba(16,63,57,.3);background:#fff;font:inherit;font-size:14px;font-weight:700;color:#103F39;cursor:pointer;touch-action:manipulation}.tlyh .m button.on{background:#103F39;color:#fff;border-color:#103F39}.tlyh .m i{font-style:normal;font-size:12.5px;color:#585B57;flex:none}.tlyh .er{color:#B3402F;font-size:14px;margin:6px 0}';
      document.head.appendChild(st0); }
    if (!document.getElementById('tkcss')) { var st = document.createElement('style'); st.id = 'tkcss';
      st.textContent = '#talk .row button{flex:1 1 104px;overflow-wrap:normal;word-break:normal;hyphens:none}#talk .row.r5 button{flex:1 1 44px}#talk textarea{display:block;width:100%;box-sizing:border-box;min-height:92px;margin:4px 0 8px;padding:10px 12px;border:1px solid rgba(16,63,57,.3);border-radius:12px;background:#fff;font:inherit;font-size:16px;line-height:1.4;color:#1F201E;resize:vertical}#talk .mic{display:inline-flex;align-items:center;gap:8px;min-height:44px;margin:0 0 12px;padding:0 16px;border-radius:999px;border:1px solid rgba(16,63,57,.3);background:#fff;font:inherit;font-size:15px;font-weight:700;color:#103F39;cursor:pointer;touch-action:manipulation}#talk .mic.on{background:#B3402F;border-color:#B3402F;color:#fff}#talk .mic b{width:9px;height:9px;border-radius:50%;background:currentColor;display:inline-block}';
      document.head.appendChild(st); }
    var fr = S.lang === 'fr', q = kQueue(), n = Number(S.tk.count || 0) + q.filter(function (x) { return !x.undo; }).length - q.filter(function (x) { return x.undo; }).length;
    var h = '<div class="sec tly" id="talk"><h3 style="font-size:26px">' + E(fr ? 'Conversations' : 'Conversations') + '</h3>'
      + (S.test ? '<div class="banner info">' + E(fr ? 'Aperçu : rien n’est enregistré.' : 'Preview: nothing is saved.') + '</div>' : '');
    if (S.tk.mine_form) {
      h += '<div class="big">' + n + '</div><p class="sub">' + E(fr ? (n === 1 ? 'conversation notée aujourd’hui' : 'conversations notées aujourd’hui') : (n === 1 ? 'conversation noted today' : 'conversations noted today')) + '</p>'
        + '<p style="margin:0 0 4px;font-size:15px">' + E(fr ? 'Une fiche par conversation, juste après. Touchez ce que vous avez entendu, ajoutez une ligne, puis Enregistrer. Aucun nom. Passez ce qui n’a pas été abordé.' : 'One per conversation, right after it. Tap what you heard, add a line if you like, then Save. No names. Skip anything that did not come up.') + '</p>'
        + kForm().map(rowK).join('')
        + '<div class="w">' + E(fr ? 'Ce qu’ils ont dit (facultatif)' : 'What they said (optional)') + '</div>'
        + '<textarea id="tkNote" maxlength="600" rows="3" placeholder="' + E(fr ? 'Écrivez, ou dictez' : 'Type, or dictate') + '">' + E((S.kp && S.kp.note) || '') + '</textarea>'
        + (kSR() ? '<button type="button" class="mic' + (S.krec ? ' on' : '') + '" data-tkmic="1" aria-pressed="' + (S.krec ? 'true' : 'false') + '"><b></b><span>' + E(S.krec ? (fr ? 'Arrêter' : 'Stop') : (fr ? 'Dicter' : 'Dictate')) + '</span></button>' : '')
        + '<button type="button" class="add" data-tkadd="1">+ ' + E(fr ? 'Enregistrer cette conversation' : 'Save this conversation') + '</button>'
        + (S.klast ? '<button type="button" class="no" data-tkundo="1">' + E(fr ? 'Annuler la dernière' : 'Undo the last one') + '</button>' : '')
        + '<p class="st">' + (S.kmsg ? E(S.kmsg) : q.length ? q.length + ' ' + E(fr ? 'en attente de connexion' : 'waiting for a connection') : E(fr ? 'Tout est enregistré' : 'All saved')) + '</p>';
    } else {
      h += '<p style="margin:0 0 4px;font-size:15px">' + E(fr ? 'Les conversations avec les personnes que nous servons se notent ici. Donnez le formulaire à quelqu’un de l’équipe.' : 'Conversations with the people we serve are noted here. Give the form to someone on the team.') + '</p>';
    }
    return h + shareK() + '</div>';
  }
  function talkFlush() {
    if (S.test || S.kbusy) return;
    var q = kQueue(); if (!q.length) return;
    var batch = q.slice(0, 40); S.kbusy = true;
    rpc('volunteer_talk_add', { p_token: token(), p_rows: batch }).then(function (r) {
      S.kbusy = false;
      if (r.ok && r.body && r.body.ok) {
        var sent = {}; batch.forEach(function (x) { sent[x.cid + (x.undo ? 'u' : '')] = 1; });
        kSave(kQueue().filter(function (x) { return !sent[x.cid + (x.undo ? 'u' : '')]; }));
        S.tk.count = r.body.count;
        if (document.getElementById('talk') && !talkTyping()) paint();
        if (kQueue().length) setTimeout(talkFlush, 300);
      } else if (r.ok && r.body && r.body.reason === 'closed') { kSave([]); S.tk.open = false; paint(); }
      else setTimeout(talkFlush, 5000);
    }).catch(function () { S.kbusy = false; setTimeout(talkFlush, 5000); });
  }
  function talkTyping() { var a = document.activeElement; return !!(a && a.id === 'tkNote'); }
  function talkMic() {
    var SR = kSR(); if (!SR) return;
    if (S.krec) { try { S.krec.stop(); } catch (e) { /* fine */ } return; }
    var r; try { r = new SR(); } catch (e) { return; }
    r.lang = S.lang === 'fr' ? 'fr-CA' : 'en-CA'; r.interimResults = false; r.continuous = true;
    r.onresult = function (e) {
      var t = ''; for (var i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) t += e.results[i][0].transcript + ' ';
      if (!t) return; S.kp = S.kp || {};
      S.kp.note = (String(S.kp.note || '') + ' ' + t).replace(/\s+/g, ' ').trim().slice(0, 600);
      var ta = document.getElementById('tkNote'); if (ta) ta.value = S.kp.note;
    };
    function done() { S.krec = null; var b = document.querySelector('#talk [data-tkmic]'); if (b) { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); var sp = b.querySelector('span'); if (sp) sp.textContent = S.lang === 'fr' ? 'Dicter' : 'Dictate'; } }
    r.onend = done; r.onerror = done;
    try { r.start(); S.krec = r; var b = document.querySelector('#talk [data-tkmic]'); if (b) { b.classList.add('on'); b.setAttribute('aria-pressed', 'true'); var sp = b.querySelector('span'); if (sp) sp.textContent = S.lang === 'fr' ? 'Arrêter' : 'Stop'; } } catch (e) { S.krec = null; }
  }
  function talkShareDo(b) {
    if (S.kshb) return;
    var rid = Number(b.getAttribute('data-tksh')), on = b.getAttribute('data-on') !== '1', fr = S.lang === 'fr';
    S.kshe = '';
    if (S.test) { S.kshe = fr ? 'Aperçu : rien n’est enregistré.' : 'Preview: nothing is saved.'; paint(); return; }
    S.kshb = true; paint();
    rpc('volunteer_talk_share', { p_token: token(), p_roster: rid, p_on: on }).then(function (r) {
      S.kshb = false;
      if (r.ok && r.body && r.body.ok) S.tk.team = r.body.team || [];
      else S.kshe = fr ? 'Cela n’a pas fonctionné. Vérifiez la connexion et réessayez.' : 'That did not go through. Check the connection and try again.';
      paint();
    }).catch(function () { S.kshb = false; S.kshe = fr ? 'Pas de connexion. Réessayez.' : 'No connection. Try again.'; paint(); });
  }
  function talkLoad() {
    if (!S.d || S.d.cancelled) return;
    rpc('volunteer_talk_get', S.test ? { p_token: token(), p_preview: true } : { p_token: token() }).then(function (r) {
      if (!r.ok || !r.body) return;
      S.tk = r.body; S.kp = S.kp || {};
      if (!S.kbound) {
        S.kbound = true;
        app.addEventListener('input', function (e) { if (e.target && e.target.id === 'tkNote') { S.kp = S.kp || {}; S.kp.note = e.target.value; } });
        app.addEventListener('click', function (e) {
          var b = e.target && e.target.closest ? e.target.closest('[data-tk],[data-tkadd],[data-tkundo],[data-tkmic],[data-tkshow],[data-tksh]') : null; if (!b) return;
          e.preventDefault(); S.kmsg = '';
          if (b.hasAttribute('data-tkshow')) { S.ksh = !S.ksh; S.kshe = ''; paint(); return; }
          if (b.hasAttribute('data-tksh')) { talkShareDo(b); return; }
          if (b.hasAttribute('data-tkmic')) { talkMic(); return; }
          if (b.hasAttribute('data-tk')) {
            var k = b.getAttribute('data-tk'), v = b.getAttribute('data-v');
            if (b.hasAttribute('data-m')) { var a = Array.isArray(S.kp[k]) ? S.kp[k].slice() : [], i = a.indexOf(v); if (i >= 0) a.splice(i, 1); else a.push(v); S.kp[k] = a; } else S.kp[k] = S.kp[k] === v ? null : v;
            paint(); return;
          }
          if (b.hasAttribute('data-tkadd')) {
            if (S.krec) { try { S.krec.stop(); } catch (z) { /* fine */ } }
            var a2 = {}; kForm().forEach(function (f) { var v2 = S.kp[f.k]; if (v2 && (!Array.isArray(v2) || v2.length)) a2[f.k] = v2; });
            var note = String(S.kp.note || '').replace(/\s+/g, ' ').trim().slice(0, 600);
            if (!Object.keys(a2).length && !note) { S.kmsg = S.lang === 'fr' ? 'Touchez au moins une réponse ou écrivez une ligne.' : 'Tap at least one answer or write a line first.'; paint(); return; }
            var x = { cid: tCid(), a: a2, lang: S.lang === 'fr' ? 'fr' : 'en' }; if (note) x.note = note;
            kSave(kQueue().concat([x])); S.klast = x.cid; S.kp = {};
            try { if (navigator.vibrate) navigator.vibrate(12); } catch (z2) { /* fine */ }
            paint(); talkFlush(); return;
          }
          if (b.hasAttribute('data-tkundo') && S.klast) {
            var q = kQueue(), j = q.map(function (y) { return y.cid; }).indexOf(S.klast);
            if (j >= 0 && !q[j].undo) q.splice(j, 1); else q.push({ cid: S.klast, undo: '1' });
            kSave(q); S.klast = null; paint(); talkFlush(); return;
          }
        });
        window.addEventListener('online', talkFlush);
      }
      paint(); talkFlush();
    }).catch(function () { /* the rest of the page still works */ });
  }
$cn0$, chr(13), ''),
  replace($cn1$spotHtml() + tallyHtml() + talkHtml() + invHtml()
        + (d.survey ? surveyHtml() :$cn1$, chr(13), ''),
  replace($cn2$spotHtml() + tallyHtml() + talkHtml() + invHtml() + surveyHtml() + teaserHtml()$cn2$, chr(13), ''),
  replace($cn3$+ teaserHtml() + tallyHtml() + talkHtml() + (S.inv && S.inv.open ? invHtml() : '')$cn3$, chr(13), ''),
  replace($cn4$    invLoad(); tallyLoad(); talkLoad();   /* wave350 */
$cn4$, chr(13), '')];
begin
  select content into c from public.site_files where path = 'c/index.html' and part = 1;
  if c is null or (select count(*) from public.site_files where path = 'c/index.html') <> 1 then raise exception 'c/index.html is not as expected'; end if;
  if md5(c) <> 'ec050f8139c1db231d19a6e16085930b' then raise exception 'c/index.html has moved since this file was made (md5 %)', md5(c); end if;
  insert into public.wa350_undo (k, v) values ('c/index.html', c) on conflict (k) do nothing;
  execute $db350$
-- wave350 database part: the conversations form on the lead's own page (one short record per conversation, no names).

create table if not exists public.pb_conversations (
  id bigint generated always as identity primary key, event_id bigint references public.volunteer_events(id) on delete set null, served_on date not null,
  city text not null default 'Montreal', roster_id bigint references public.event_roster(id) on delete set null, by_name text, client_id text,
  answers jsonb not null default '{}'::jsonb, note text, lang text, recorded_at timestamptz not null default now());
create unique index if not exists pb_conversations_client on public.pb_conversations (roster_id, client_id) where client_id is not null;
create index if not exists pb_conversations_event on public.pb_conversations (event_id);
alter table public.pb_conversations enable row level security;
revoke all on public.pb_conversations from anon, authenticated;
grant select on public.pb_conversations to authenticated;
grant all on public.pb_conversations to service_role;
drop policy if exists pb_conversations_staff_read on public.pb_conversations;
create policy pb_conversations_staff_read on public.pb_conversations for select to authenticated using ((select public.is_wa_staff()));
comment on table public.pb_conversations is 'wave350: one anonymous record per conversation with a person we serve, noted by a community lead (or a teammate given it) on their own page. Written through volunteer_talk_add.';

insert into public.pb_forms (key, title, def, updated_by) values ('talk', 'Conversations', $j${"fields":[
 {"k":"needs","core":false,"active":true,"m":true,"en":"What do they need most?","fr":"De quoi ont-ils le plus besoin?","o":[{"v":"food","en":"Food","fr":"Nourriture","active":true},{"v":"clothing","en":"Clothing","fr":"Vêtements","active":true},{"v":"hygiene","en":"Hygiene products","fr":"Produits d’hygiène","active":true},{"v":"housing","en":"Housing","fr":"Logement","active":true},{"v":"social","en":"Social connection","fr":"Lien social","active":true},{"v":"employment","en":"Work","fr":"Emploi","active":true},{"v":"mental_health","en":"Mental health","fr":"Santé mentale","active":true},{"v":"health","en":"Health care","fr":"Soins de santé","active":true},{"v":"none","en":"None mentioned","fr":"Aucun mentionné","active":true}]},
 {"k":"meal","core":false,"active":true,"m":false,"en":"The meal today (1 poor, 5 great)","fr":"Le repas aujourd’hui (1 faible, 5 excellent)","o":[{"v":"r1","en":"1","fr":"1","active":true},{"v":"r2","en":"2","fr":"2","active":true},{"v":"r3","en":"3","fr":"3","active":true},{"v":"r4","en":"4","fr":"4","active":true},{"v":"r5","en":"5","fr":"5","active":true}]},
 {"k":"service","core":false,"active":true,"m":false,"en":"How the serving worked for them (1 to 5)","fr":"Le service pour eux (1 à 5)","o":[{"v":"r1","en":"1","fr":"1","active":true},{"v":"r2","en":"2","fr":"2","active":true},{"v":"r3","en":"3","fr":"3","active":true},{"v":"r4","en":"4","fr":"4","active":true},{"v":"r5","en":"5","fr":"5","active":true}]},
 {"k":"phone","core":false,"active":true,"m":false,"en":"Do they have a phone?","fr":"Ont-ils un téléphone?","o":[{"v":"smart","en":"Smartphone","fr":"Téléphone intelligent","active":true},{"v":"basic","en":"Basic phone","fr":"Téléphone de base","active":true},{"v":"none","en":"No phone","fr":"Pas de téléphone","active":true}]},
 {"k":"online","core":false,"active":true,"m":false,"en":"Can they get online most days?","fr":"Vont-ils en ligne la plupart des jours?","o":[{"v":"data","en":"Data plan","fr":"Forfait de données","active":true},{"v":"wifi","en":"Wi-Fi only","fr":"Wi-Fi seulement","active":true},{"v":"rarely","en":"Rarely","fr":"Rarement","active":true},{"v":"no","en":"No","fr":"Non","active":true}]},
 {"k":"find","core":false,"active":true,"m":true,"en":"How do they find meals and services?","fr":"Comment trouvent-ils repas et services?","o":[{"v":"word_of_mouth","en":"Word of mouth","fr":"Bouche-à-oreille","active":true},{"v":"outreach","en":"Outreach workers","fr":"Intervenants de rue","active":true},{"v":"shelter","en":"Shelter or drop-in","fr":"Refuge ou centre de jour","active":true},{"v":"phone_internet","en":"Phone or internet","fr":"Téléphone ou Internet","active":true},{"v":"line211","en":"211","fr":"Le 211","active":true}]},
 {"k":"hubpage","core":false,"active":true,"m":false,"en":"Would a phone page of nearby services help them?","fr":"Une page des services à proximité les aiderait?","o":[{"v":"yes","en":"Yes","fr":"Oui","active":true},{"v":"maybe","en":"Maybe","fr":"Peut-être","active":true},{"v":"no","en":"No","fr":"Non","active":true}]}
]}$j$::jsonb, 'wave350') on conflict (key) do nothing;

-- who has the conversations form: every community lead, anyone given Conversations on the Team tab, anyone a lead gave it to
create or replace function public.pb_may_talk(p_roster bigint) returns boolean language sql stable security definer set search_path to '' as $f$
  select lower(coalesce(r.role, '')) in ('community_debrief', 'community_talker') or coalesce(r.detail->>'cl_job', '') = 'talk' or coalesce(r.detail->>'talk_help', '') = 'true'
  from public.event_roster r where r.id = p_roster
$f$;
revoke all on function public.pb_may_talk(bigint) from public, anon, authenticated;
grant execute on function public.pb_may_talk(bigint) to service_role;
create or replace function public.pb_can_share_talk(p_roster bigint) returns boolean language sql stable security definer set search_path to '' as $f$
  select lower(coalesce(r.role, '')) in ('community_debrief', 'community_talker', 'team_leader') or coalesce(r.detail->>'cl_job', '') = 'talk'
  from public.event_roster r where r.id = p_roster
$f$;
revoke all on function public.pb_can_share_talk(bigint) from public, anon, authenticated;
grant execute on function public.pb_can_share_talk(bigint) to service_role;
create or replace function public.pb_talk_team(p_roster bigint) returns jsonb language sql stable security definer set search_path to '' as $f$
  select coalesce(jsonb_agg(jsonb_build_object('rid', t.id,
           'name', split_part(btrim(t.person_name), ' ', 1) || case when position(' ' in btrim(t.person_name)) > 0 then ' ' || left(split_part(btrim(t.person_name), ' ', array_length(string_to_array(btrim(t.person_name), ' '), 1)), 1) || '.' else '' end,
           'role_en', public.wa171_role_label(t.role, 'en'), 'role_fr', public.wa171_role_label(t.role, 'fr'),
           'on', coalesce(t.detail->>'talk_help', '') = 'true',
           'fixed', lower(coalesce(t.role, '')) in ('community_debrief', 'community_talker') or coalesce(t.detail->>'cl_job', '') = 'talk')
         order by case lower(t.role) when 'community_debrief' then 0 when 'server' then 1 when 'team_leader' then 2 else 3 end, t.person_name), '[]'::jsonb)
    from public.event_roster me join public.event_roster t on t.event_id = me.event_id and t.id <> me.id
   where me.id = p_roster and lower(coalesce(t.status, '')) like 'confirm%' and coalesce(t.confirm_status, '') <> 'declined' and t.confirm_token is not null and lower(coalesce(t.role, '')) <> 'cook'
$f$;
revoke all on function public.pb_talk_team(bigint) from public, anon, authenticated;
grant execute on function public.pb_talk_team(bigint) to service_role;

create or replace function public.volunteer_talk_get(p_token text, p_preview boolean default false) returns jsonb
language plpgsql security definer set search_path to '' as $function$
declare r record; v_n int; v_mine int; v_share boolean;
begin
  if p_token is null or length(p_token) < 12 then return null; end if;
  select er.id, er.status, er.confirm_status, er.event_id, e.event_date, e.status as ev_status, e.start_time into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.confirm_token = p_token;
  if not found or r.ev_status = 'cancelled' or lower(coalesce(r.status, '')) in ('cancelled', 'unavailable') or r.confirm_status = 'declined' then return null; end if;
  v_share := coalesce(public.pb_can_share_talk(r.id), false);
  if not coalesce(public.pb_may_talk(r.id), false) and not v_share then return null; end if;
  select count(*), count(*) filter (where roster_id = r.id) into v_n, v_mine from public.pb_conversations where event_id = r.event_id;
  return jsonb_build_object('open', public.wa298_tally_open(r.event_date, r.start_time), 'preview', coalesce(p_preview, false), 'mine_form', coalesce(public.pb_may_talk(r.id), false),
    'count', v_n, 'mine', v_mine, 'form', public.pb_form_public('talk'), 'can_share', v_share, 'team', case when v_share then public.pb_talk_team(r.id) else '[]'::jsonb end);
end $function$;
revoke all on function public.volunteer_talk_get(text, boolean) from public;
grant execute on function public.volunteer_talk_get(text, boolean) to anon, authenticated, service_role;

create or replace function public.volunteer_talk_add(p_token text, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $function$
declare r record; x jsonb; f jsonb; v_form jsonb; v_a jsonb; v_k text; v_ok text[]; v_note text; v_added int := 0; v_id bigint; v_n int;
begin
  if p_token is null or length(p_token) < 12 or p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 40 then return jsonb_build_object('ok', false, 'reason', 'bad'); end if;
  select er.id, er.person_name, er.status, er.confirm_status, er.event_id, e.event_date, e.status as ev_status, e.start_time, e.location into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.confirm_token = p_token;
  if not found or not coalesce(public.pb_may_talk(r.id), false) then return jsonb_build_object('ok', false); end if;
  if r.ev_status = 'cancelled' or lower(coalesce(r.status, '')) in ('cancelled', 'unavailable') or r.confirm_status = 'declined' then return jsonb_build_object('ok', false, 'reason', 'not_on_it'); end if;
  if not public.wa298_tally_open(r.event_date, r.start_time) then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;
  v_form := public.pb_form_public('talk');
  for x in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(x) <> 'object' or coalesce(x->>'cid', '') !~ '^[A-Za-z0-9_-]{4,40}$' then continue; end if;
    if coalesce(x->>'undo', '') = '1' then delete from public.pb_conversations where roster_id = r.id and client_id = x->>'cid'; continue; end if;
    v_a := '{}'::jsonb;
    if jsonb_typeof(x->'a') = 'object' then
      for f in select value from jsonb_array_elements(coalesce(v_form->'fields', '[]'::jsonb)) loop
        v_k := f->>'k'; if not (x->'a') ? v_k then continue; end if;
        select coalesce(array_agg(o->>0), '{}') into v_ok from jsonb_array_elements(f->'o') o;
        if coalesce((f->>'m')::boolean, false) and jsonb_typeof(x->'a'->v_k) = 'array' then
          v_a := v_a || jsonb_build_object(v_k, (select coalesce(jsonb_agg(distinct t), '[]'::jsonb) from jsonb_array_elements_text(x->'a'->v_k) t where t = any (v_ok)));
        elsif jsonb_typeof(x->'a'->v_k) = 'string' and (x->'a'->>v_k) = any (v_ok) then
          v_a := v_a || jsonb_build_object(v_k, x->'a'->>v_k);
        end if;
      end loop;
    end if;
    v_note := nullif(left(btrim(regexp_replace(coalesce(x->>'note', ''), '\s+', ' ', 'g')), 600), '');
    if v_a = '{}'::jsonb and v_note is null then continue; end if;
    insert into public.pb_conversations (event_id, served_on, city, roster_id, by_name, client_id, answers, note, lang)
    values (r.event_id, r.event_date, public.wa298_city(r.location), r.id, r.person_name, x->>'cid', v_a, v_note, case when x->>'lang' in ('en', 'fr') then x->>'lang' end)
    on conflict (roster_id, client_id) where client_id is not null do nothing returning id into v_id;
    if v_id is not null then v_added := v_added + 1; v_id := null; end if;
  end loop;
  select count(*) into v_n from public.pb_conversations where event_id = r.event_id;
  return jsonb_build_object('ok', true, 'added', v_added, 'count', v_n);
end $function$;
revoke all on function public.volunteer_talk_add(text, jsonb) from public;
grant execute on function public.volunteer_talk_add(text, jsonb) to anon, authenticated, service_role;

create or replace function public.volunteer_talk_share(p_token text, p_roster bigint, p_on boolean) returns jsonb
language plpgsql security definer set search_path to '' as $function$
declare r record; t record;
begin
  if p_token is null or length(p_token) < 12 or p_roster is null then return jsonb_build_object('ok', false, 'reason', 'bad'); end if;
  select er.id, er.event_id, er.person_name, er.status, er.confirm_status, e.status as ev_status into r
    from public.event_roster er join public.volunteer_events e on e.id = er.event_id where er.confirm_token = p_token;
  if not found or r.ev_status = 'cancelled' or lower(coalesce(r.status, '')) in ('cancelled', 'unavailable') or r.confirm_status = 'declined'
     or not coalesce(public.pb_can_share_talk(r.id), false) then return jsonb_build_object('ok', false, 'reason', 'not_yours'); end if;
  select x.id, x.status, x.confirm_status into t from public.event_roster x where x.id = p_roster and x.event_id = r.event_id and x.id <> r.id;
  if not found or lower(coalesce(t.status, '')) not like 'confirm%' or coalesce(t.confirm_status, '') = 'declined' then return jsonb_build_object('ok', false, 'reason', 'not_confirmed'); end if;
  if coalesce(p_on, false) then
    update public.event_roster set detail = coalesce(detail, '{}'::jsonb) || jsonb_build_object('talk_help', 'true', 'talk_help_by', r.person_name, 'talk_help_at', now()) where id = t.id;
  else
    update public.event_roster set detail = coalesce(detail, '{}'::jsonb) - 'talk_help' - 'talk_help_by' - 'talk_help_at' where id = t.id;
  end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('event_roster', t.id::text, 'talk_help', null, case when coalesce(p_on, false) then 'given the conversations form by ' else 'the conversations form taken back by ' end || coalesce(r.person_name, 'a lead'), 'volunteer page');
  return jsonb_build_object('ok', true, 'team', public.pb_talk_team(r.id));
end $function$;
revoke all on function public.volunteer_talk_share(text, bigint, boolean) from public;
grant execute on function public.volunteer_talk_share(text, bigint, boolean) to anon, authenticated, service_role;

$db350$;
  c_new := c;
  for i in 1..array_length(colds, 1) loop
    o := colds[i]; nw := cnews[i]; n := (length(c_new) - length(replace(c_new, o, ''))) / length(o);
    if n <> 1 then raise exception 'c/index.html: edit % matches % times', i, n; end if;
    c_new := replace(c_new, o, nw);
  end loop;
  if md5(c_new) <> 'da04d7fdd048f3bb80714b55245f20e8' then raise exception 'c/index.html: unexpected result %', md5(c_new); end if;
  update public.site_files set content = c_new, updated_at = now() where path = 'c/index.html' and part = 1;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('release', 'c/index.html', 'wave350', md5(c), md5(c_new) || ': the conversations form on the lead page', 'wave350');
end $pg$;
-- PUBLISH
select public.call_edge('host-sync', '{}'::jsonb) as host_sync;
