-- Add Mercado Pago as a second provider without changing existing Wompi records.
alter table public.subscriptions
  add column if not exists payment_provider text not null default 'wompi',
  add column if not exists provider_subscription_id text;

alter table public.subscriptions
  drop constraint if exists subscriptions_payment_provider_check;
alter table public.subscriptions
  add constraint subscriptions_payment_provider_check
  check (payment_provider in ('wompi', 'mercadopago'));

create unique index if not exists subscriptions_provider_subscription_uidx
  on public.subscriptions (payment_provider, provider_subscription_id)
  where provider_subscription_id is not null;

alter table public.subscription_payments
  add column if not exists payment_provider text not null default 'wompi',
  add column if not exists provider_payment_id text,
  add column if not exists provider_subscription_id text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.subscription_payments
  drop constraint if exists subscription_payments_payment_provider_check;
alter table public.subscription_payments
  add constraint subscription_payments_payment_provider_check
  check (payment_provider in ('wompi', 'mercadopago'));

create unique index if not exists subscription_payments_provider_payment_uidx
  on public.subscription_payments (payment_provider, provider_payment_id)
  where provider_payment_id is not null;

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('wompi', 'mercadopago')),
  event_id text not null,
  resource_id text,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  unique (provider, event_id)
);

alter table public.payment_webhook_events enable row level security;
revoke all on public.payment_webhook_events from anon, authenticated;
grant all on public.payment_webhook_events to service_role;

-- This RPC is service-role only. The webhook must verify the provider signature
-- and retrieve the authoritative resource from Mercado Pago before calling it.
create or replace function public.apply_mercadopago_subscription_event(
  p_event_id text,
  p_event_type text,
  p_reference text,
  p_preapproval_id text default null,
  p_preapproval_status text default null,
  p_authorized_payment_id text default null,
  p_payment_status text default null,
  p_amount_in_cents bigint default null,
  p_payment_date timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.subscription_payments%rowtype;
  v_period text;
  v_status text;
  v_payment_status text;
  v_inserted_id uuid;
begin
  if coalesce(p_event_id, '') = '' or coalesce(p_event_type, '') = '' then
    raise exception 'Evento incompleto.' using errcode = '22023';
  end if;

  insert into public.payment_webhook_events(provider,event_id,resource_id,event_type)
  values ('mercadopago',p_event_id,coalesce(p_authorized_payment_id,p_preapproval_id),p_event_type)
  on conflict (provider,event_id) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    return jsonb_build_object('result','duplicate');
  end if;

  if p_reference is null or p_reference = '' then
    update public.payment_webhook_events set processed_at=now()
    where provider='mercadopago' and event_id=p_event_id;
    return jsonb_build_object('result','ignored','reason','missing_reference');
  end if;

  select * into v_payment
  from public.subscription_payments
  where reference=p_reference
  limit 1;

  if not found then
    update public.payment_webhook_events set processed_at=now()
    where provider='mercadopago' and event_id=p_event_id;
    return jsonb_build_object('result','ignored','reason','unknown_reference');
  end if;

  if p_amount_in_cents is not null and p_amount_in_cents <> v_payment.amount_in_cents then
    raise exception 'El monto recibido no coincide con el pago esperado.' using errcode='22023';
  end if;

  select billing_period into v_period from public.plans where id=v_payment.plan_id;

  if p_preapproval_id is not null then
    update public.subscriptions
    set payment_provider='mercadopago',
        provider_subscription_id=p_preapproval_id,
        external_reference=p_reference
    where business_id=v_payment.business_id
      and plan_id=v_payment.plan_id;
  end if;

  v_payment_status := upper(coalesce(p_payment_status,''));
  if v_payment_status in ('approved','authorized') then
    -- Keep a separate ledger row for every recurring charge.
    if v_payment.provider_payment_id is null and v_payment.status='PENDING' then
      update public.subscription_payments
      set status='APPROVED',
          provider_payment_id=p_authorized_payment_id,
          provider_subscription_id=coalesce(p_preapproval_id,provider_subscription_id),
          paid_at=coalesce(p_payment_date,now()),
          updated_at=now(),
          metadata=metadata || jsonb_build_object('mercadopago_event_type',p_event_type)
      where id=v_payment.id;
    else
      insert into public.subscription_payments(
        business_id,plan_id,reference,amount_in_cents,currency,status,
        payment_provider,provider_payment_id,provider_subscription_id,paid_at,metadata
      ) values (
        v_payment.business_id,v_payment.plan_id,
        'MP-RENEWAL-' || coalesce(p_authorized_payment_id,gen_random_uuid()::text),
        coalesce(p_amount_in_cents,v_payment.amount_in_cents),'COP','APPROVED',
        'mercadopago',p_authorized_payment_id,p_preapproval_id,
        coalesce(p_payment_date,now()),jsonb_build_object('mercadopago_event_type',p_event_type,'original_reference',p_reference)
      ) on conflict (payment_provider,provider_payment_id) do nothing;
    end if;

    update public.subscriptions
    set payment_provider='mercadopago',
        provider_subscription_id=coalesce(p_preapproval_id,provider_subscription_id),
        status='active',
        starts_at=coalesce(starts_at,now()),
        ends_at=case when v_period='year'
          then coalesce(p_payment_date,now()) + interval '1 year'
          else coalesce(p_payment_date,now()) + interval '1 month' end,
        external_reference=p_reference
    where business_id=v_payment.business_id
      and plan_id=v_payment.plan_id;

  elsif v_payment_status in ('rejected','cancelled','refunded','charged_back') then
    if v_payment.provider_payment_id is null and v_payment.status='PENDING' then
      update public.subscription_payments
      set status='DECLINED',
          provider_payment_id=p_authorized_payment_id,
          provider_subscription_id=coalesce(p_preapproval_id,provider_subscription_id),
          updated_at=now(),
          metadata=metadata || jsonb_build_object('mercadopago_event_type',p_event_type)
      where id=v_payment.id;
    else
      insert into public.subscription_payments(
        business_id,plan_id,reference,amount_in_cents,currency,status,
        payment_provider,provider_payment_id,provider_subscription_id,metadata
      ) values (
        v_payment.business_id,v_payment.plan_id,
        'MP-RENEWAL-' || coalesce(p_authorized_payment_id,gen_random_uuid()::text),
        coalesce(p_amount_in_cents,v_payment.amount_in_cents),'COP','DECLINED',
        'mercadopago',p_authorized_payment_id,p_preapproval_id,
        jsonb_build_object('mercadopago_event_type',p_event_type,'original_reference',p_reference)
      ) on conflict (payment_provider,provider_payment_id) do nothing;
    end if;

    update public.subscriptions
    set status='past_due'
    where business_id=v_payment.business_id
      and plan_id=v_payment.plan_id
      and status='active';

  elsif lower(coalesce(p_preapproval_status,'')) in ('cancelled','paused') then
    update public.subscriptions
    set payment_provider='mercadopago',
        provider_subscription_id=coalesce(p_preapproval_id,provider_subscription_id),
        status=case when lower(p_preapproval_status)='cancelled' then 'cancelled' else 'past_due' end
    where business_id=v_payment.business_id
      and plan_id=v_payment.plan_id;
  end if;

  update public.payment_webhook_events
  set processed_at=now(), processing_error=null
  where provider='mercadopago' and event_id=p_event_id;

  return jsonb_build_object('result','processed','business_id',v_payment.business_id);
exception when others then
  update public.payment_webhook_events
  set processing_error=sqlerrm
  where provider='mercadopago' and event_id=p_event_id;
  raise;
end;
$$;

revoke all on function public.apply_mercadopago_subscription_event(text,text,text,text,text,text,text,bigint,timestamptz) from public, anon, authenticated;
grant execute on function public.apply_mercadopago_subscription_event(text,text,text,text,text,text,text,bigint,timestamptz) to service_role;
