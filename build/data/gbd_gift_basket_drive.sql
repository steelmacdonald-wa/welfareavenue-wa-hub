-- 15/10/26 - The Holiday Gift Basket Drive page (Steel's fundraising follow-through, Amanda Zoldak's team).
-- welfareavenue.com/gift-basket-drive/ and /fr/paniers-cadeaux/ send every drive gift through the Hub's donation page with
-- the drive's campaign, so Welfare Avenue, Scattered and the One Bag Challenge can all share one link and one total.
--   1. app_config donate_campaigns: the campaigns the donation page knows (JSON, keyed by the slug a button or a link
--      passes: data-wa-campaign, or ?c= on hub.welfareavenue.com/give). Admins only (wa_app_config_guard covers donate_*).
--   2. crm_stripe_gift: a gift made through a campaign records its name in crm_donations.campaign (from the session's
--      metadata wa_campaign, which the donate function v5 sets); everything else is unchanged.
--   3. www_campaign_totals(slug): the public total for a campaign page (raised, donors, gifts, the goals): aggregates only,
--      nothing personal; anonymous by design, like www_upcoming.
-- Applied as migration gbd_gift_basket_drive (Supabase), 15/10/26.

insert into public.app_config (key, value, updated_at) values ('donate_campaigns', $json${
  "gift-basket-drive": {
    "name": "Holiday Gift Basket Drive 2026",
    "designation": "Holiday Gift Basket Drive",
    "designation_fr": "Collecte de paniers-cadeaux des Fêtes",
    "title": "Give to the Holiday Gift Basket Drive",
    "title_fr": "Donner à la collecte de paniers-cadeaux des Fêtes",
    "intro": "Every gift helps us fill, wrap and hand-deliver holiday gifts across Montreal this December. Our goal this year: 6,000 gifts.",
    "intro_fr": "Chaque don nous aide à remplir, emballer et livrer des cadeaux partout à Montréal en décembre. Notre objectif cette année : 6 000 cadeaux.",
    "photo": "https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/photos/web/2025-12-gift-baskets-wrapping.jpg",
    "monthly": false,
    "open": true,
    "goal": null,
    "gift_goal": 6000,
    "fund_event_id": 4,
    "page": "https://welfareavenue.com/gift-basket-drive/",
    "page_fr": "https://welfareavenue.com/fr/paniers-cadeaux/"
  }
}$json$, now())
on conflict (key) do nothing;

create or replace function public.crm_stripe_gift(p_ext text, p_cid bigint, p_amount numeric, p_currency text, p_when timestamp with time zone, p_meta jsonb, p_extra jsonb, p_recurring boolean, p_plan bigint, p_raw jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_gid bigint;
  v_fee numeric := nullif(coalesce(p_extra ->> 'fee_cents', ''), '')::numeric / 100;
  v_net numeric := nullif(coalesce(p_extra ->> 'net_cents', ''), '')::numeric / 100;
  v_cover numeric := coalesce(nullif(coalesce(p_meta ->> 'wa_fee_cover_cents', ''), '')::numeric, 0) / 100;
  v_tk text := case when coalesce(p_meta ->> 'wa_tribute_kind', '') in ('honour', 'memory') then p_meta ->> 'wa_tribute_kind' end;
  v_campaign text := nullif(left(btrim(coalesce(p_meta ->> 'wa_campaign', '')), 120), '');
  v_note text;
begin
  if coalesce(p_ext, '') = '' then raise exception 'a Stripe gift needs its payment id'; end if;
  v_note := case when p_recurring then 'Monthly gift through the Hub''s donation page' else 'Online gift through the Hub''s donation page' end ||
            case when v_campaign is not null then ' (' || v_campaign || ')' else '' end ||
            case when v_cover > 0 then '; includes ' || to_char(v_cover, 'FM$999,990.00') || ' to help cover the card fee' else '' end || '.';
  insert into public.crm_donations (contact_id, amount, currency, donated_at, platform, designation, campaign, external_id, recurring, fee, net_amount,
                                    receipt_eligible, notes, raw, created_by, updated_by, kind, tribute_kind, tribute_name, plan_id)
  values (p_cid, greatest(coalesce(p_amount, 0), 0), upper(coalesce(nullif(p_currency, ''), 'cad')), coalesce(p_when, now()), 'stripe',
          nullif(btrim(coalesce(p_meta ->> 'wa_designation', '')), ''), v_campaign, p_ext, coalesce(p_recurring, false), v_fee, v_net,
          true, v_note, p_raw, 'donation page', 'donation page', 'donation', v_tk,
          case when v_tk is not null then nullif(btrim(coalesce(p_meta ->> 'wa_tribute_name', '')), '') end, p_plan)
  on conflict (platform, external_id) where external_id is not null do nothing
  returning id into v_gid;
  if v_gid is null then
    return jsonb_build_object('already', true, 'gift_id', (select id from public.crm_donations where platform = 'stripe' and external_id = p_ext));
  end if;
  return jsonb_build_object('gift_id', v_gid, 'amount', p_amount, 'contact_id', p_cid);
end $function$;

comment on function public.crm_stripe_gift(text, bigint, numeric, text, timestamp with time zone, jsonb, jsonb, boolean, bigint, jsonb) is
  'Records one online gift (wave161), once: platform stripe, the Stripe payment (pi_...) or monthly invoice (in_...) as external_id, the amount, the date paid, the designation and tribute the donor chose, the Stripe fee and net amount when known, what they added to cover the card fee (in the notes), a monthly payment''s plan, and since 15/10/26 the campaign (metadata wa_campaign, set by donate v5 when the gift comes through a campaign link such as the Holiday Gift Basket Drive page; also named in the notes). A kind donation, receipt eligible: it joins the receipts due. Its insert starts the gift automations (crm_auto_on_gift) like any gift. Internal to crm_stripe_apply.';

create or replace function public.www_campaign_totals(p_slug text)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
declare
  v_cfg jsonb; c jsonb; v_name text; r record;
begin
  begin
    select value::jsonb into v_cfg from public.app_config where key = 'donate_campaigns';
  exception when others then v_cfg := null;
  end;
  c := case when v_cfg is not null and jsonb_typeof(v_cfg) = 'object' then v_cfg -> lower(btrim(coalesce(p_slug, ''))) end;
  if c is null or jsonb_typeof(c) <> 'object' or coalesce(c ->> 'name', '') = '' then
    return jsonb_build_object('error', 'not_found');
  end if;
  v_name := c ->> 'name';
  select coalesce(sum(d.amount - coalesce(d.refunded_amount, 0)), 0) as raised,
         count(distinct d.contact_id) + count(*) filter (where d.contact_id is null) as donors,
         count(*) as gifts,
         max(d.donated_at) as last_gift
    into r
    from public.crm_donations d
   where d.campaign = v_name and d.kind in ('donation', 'sponsorship') and d.amount > coalesce(d.refunded_amount, 0);
  return jsonb_build_object(
    'slug', lower(btrim(p_slug)), 'name', v_name,
    'raised', round(r.raised, 2), 'donors', r.donors, 'gifts', r.gifts,
    'goal', case when jsonb_typeof(c -> 'goal') = 'number' then c -> 'goal' else 'null'::jsonb end,
    'gift_goal', case when jsonb_typeof(c -> 'gift_goal') = 'number' then c -> 'gift_goal' else 'null'::jsonb end,
    'open', coalesce((c ->> 'open')::boolean, true),
    'last_gift_at', r.last_gift, 'as_of', now());
end $function$;

comment on function public.www_campaign_totals(text) is
  '15/10/26 (Holiday Gift Basket Drive page): the public progress of a donation campaign for its page on welfareavenue.com: raised (CAD, gifts of kind donation or sponsorship whose crm_donations.campaign is the campaign''s name in app_config donate_campaigns, less refunds; online gifts and gifts recorded by hand with that campaign alike), donors (distinct contacts), gifts, the money goal and the gift goal from the settings, the last gift''s time. Aggregates only, never a name or an amount of one gift. Anonymous by design (security definer), like www_upcoming.';

revoke execute on function public.www_campaign_totals(text) from public, anon, authenticated;
grant execute on function public.www_campaign_totals(text) to anon, authenticated;

comment on column public.crm_donations.campaign is
  'The campaign or event a gift belongs to (Keela''s campaign for imported gifts, typed by the team for a gift recorded by hand, or since 15/10/26 set by the donation page from a campaign link: app_config donate_campaigns name, e.g. Holiday Gift Basket Drive 2026). www_campaign_totals sums a campaign by this exact name.';
