-- Welfare Avenue Hub: wave290 undo, 06/11/26. Puts back what build/data/wa290_home_servings.sql changed, exactly:
--   wa191_onb_signup's text (each wave290 replacement reversed, checked by count; md5 fa51b5d8f40d7ec15d8efd97f661c125 as live had it on 06/11/26)
--   and its comment; drops wa290_home_servings and wa290_home_signup; removes app_config servings_card_from.
-- Servings people confirmed from Home stay confirmed (their roster rows say via home); Requests stay in the inbox. Nothing else is touched.
-- Run the page undo first (the candidate.html from before wave290), so no page calls the dropped functions. Safe to run twice.
-- The comment is restored through EXECUTE so build/gen_data_model.py keeps reading the wave290 text from the migration, not this file.

do $undo$
declare v text; a text[]; b text[]; k int[]; i int; n int;
begin
  v := pg_get_functiondef('public.wa191_onb_signup(bigint[],text,text)'::regprocedure);
  if position('wa.signup_via' in v) > 0 then
    a := array[
      $x$v_n int := 0; v_step boolean := false;$x$,
      $x$'Team member; signed up for a serving in the onboarding (wave191p)'$x$,
      $x$jsonb_build_object('attending', 'yes', 'via', 'onboarding', 'at', now()), jsonb_build_object('source', 'onboarding', 'member', v_email), 960)$x$,
      $x$|| ' (the onboarding)', v_email);$x$,
      $x$|| jsonb_build_object('attending', 'yes', 'via', 'onboarding', 'at', now())$x$,
      $x$'From', 'The onboarding: they are already Confirmed on the roster'),$x$,
      $x$'requested', v_name, v_email, 'onboarding', v_ops->>'name')$x$
    ];
    b := array[
      $x$v_n int := 0; v_step boolean := false; v_via text := case when current_setting('wa.signup_via', true) = 'home' then 'home' else 'onboarding' end;$x$,
      $x$'Team member; signed up for a serving ' || case when v_via = 'home' then 'from Home (wave290)' else 'in the onboarding (wave191p)' end$x$,
      $x$jsonb_build_object('attending', 'yes', 'via', v_via, 'at', now()), jsonb_build_object('source', v_via, 'member', v_email), 960)$x$,
      $x$|| case when v_via = 'home' then ' (Home)' else ' (the onboarding)' end, v_email);$x$,
      $x$|| jsonb_build_object('attending', 'yes', 'via', v_via, 'at', now())$x$,
      $x$'From', case when v_via = 'home' then 'Home: they are already Confirmed on the roster' else 'The onboarding: they are already Confirmed on the roster' end),$x$,
      $x$'requested', v_name, v_email, v_via, v_ops->>'name')$x$
    ];
    k := array[1, 2, 1, 1, 1, 1, 1];
    for i in reverse array_length(b, 1) .. 1 loop
      n := (length(v) - length(replace(v, b[i], ''))) / length(b[i]);
      if n <> k[i] then raise exception 'wave290 undo: wa191_onb_signup moved since wave290 (replacement %, found % times, expected %)', i, n, k[i]; end if;
      v := replace(v, b[i], a[i]);
    end loop;
    execute v;
  end if;
  execute $c$comment on function public.wa191_onb_signup(bigint[], text, text) is 'wave191p: a team member chooses servings in the onboarding: found by their email (the volunteer list, then the CRM, else a new volunteer record, one record with the CRM), Confirmed on each open serving chosen (six at most; confirm.via onboarding; role server, photographer, community_talker, cook or driver), a Request to Operations Montreal (serving-signup, assigned to the operations lead) with the dates, the role and their message, and their onboarding step Mandatory volunteering (86e1cj9hg) ticked (step: true when they have it and it is done). Logged; autotick. Team members only.'$c$;
end $undo$;

drop function if exists public.wa290_home_signup(bigint[], text);
drop function if exists public.wa290_home_servings();
delete from public.app_config where key = 'servings_card_from';
