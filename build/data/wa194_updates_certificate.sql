-- wave194 (02/10/26): Updated since you finished asks people to open a changed step before they close it, and the
-- certificate's signature is an admin setting. Steel: "Instead I'd like for them to haft to open the link of the module to
-- re do it and then they can close it" and "the certificate members get should be better branded with our branding and
-- I'll add my signature".

-- 1. who opened a changed onboarding step (its module, its avenue or the step in their plan): Close shows after that
create table public.onboarding_update_opens (
  id bigint generated always as identity primary key,
  onboarding_id bigint not null references public.onboardings(id) on update cascade on delete cascade,
  template_id text not null references public.onboarding_template(id) on update cascade on delete cascade,
  template_updated_at timestamptz not null,
  opened_at timestamptz not null default now(),
  opened_by text
);
create unique index onboarding_update_opens_once on public.onboarding_update_opens (onboarding_id, template_id, template_updated_at);
create index onboarding_update_opens_template on public.onboarding_update_opens (template_id);
alter table public.onboarding_update_opens enable row level security;
create policy onb_opens_staff on public.onboarding_update_opens for all to authenticated
  using ((select public.is_wa_staff())) with check ((select public.is_wa_staff()));
revoke all on public.onboarding_update_opens from anon;
comment on table public.onboarding_update_opens is 'wave194: a person opened a step of the master onboarding that changed after they finished (Updated since you finished in the Avenue Academy): the module, the avenue or the step in their plan. Opening is what brings Close, which writes onboarding_update_acks. One row per person per version of the step (template_updated_at). Staff read and write, like onboarding_update_acks.';
comment on column public.onboarding_update_opens.onboarding_id is 'onboardings.id: whose onboarding. Foreign key (on delete cascade).';
comment on column public.onboarding_update_opens.template_id is 'onboarding_template.id: the step that changed. Foreign key (on delete cascade).';
comment on column public.onboarding_update_opens.template_updated_at is 'The version of the step they opened (onboarding_template.updated_at at the time). A later change asks again.';
comment on column public.onboarding_update_opens.opened_at is 'When they opened it.';
comment on column public.onboarding_update_opens.opened_by is 'Who opened it (the Hub''s display name, as acked_by).';
comment on table public.onboarding_update_acks is 'Records that a person acknowledged a changed onboarding step (template_updated_at is the version they saw). Since wave194 the Hub writes it from Close, which shows only after the person opened the step (onboarding_update_opens).';

-- 2. the certificate's signature (app_config cert_signature) changes only through an admin, like the email and receipt settings
create or replace function public.wa_app_config_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare k text := coalesce(new.key, old.key);
begin
  if (k like 'mail\_%' or k like 'receipt\_%' or k like 'donate\_%' or k like 'loom\_%' or k like 'sms\_%' or k like 'cert\_%') and coalesce(auth.role(), '') = 'authenticated' and not coalesce(public.is_wa_admin(), false) then
    raise exception 'Only an admin can change % (email, receipt, donation page, Loom pull, text and certificate settings).', k;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $function$;
comment on function public.wa_app_config_guard() is 'Trigger on app_config (wave158a, wave161, wave194): the mail_*, receipt_*, donate_*, loom_*, sms_* and cert_* settings change only through an admin or the service role; other settings stay as their policies allow. cert_signature is the signature on the Avenue Academy''s certificates (wave194).';
