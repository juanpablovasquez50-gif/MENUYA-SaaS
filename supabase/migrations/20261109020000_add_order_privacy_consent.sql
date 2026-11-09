-- Store evidence of the buyer's privacy notice and authorization for each storefront order.
alter table public.orders
  add column if not exists privacy_policy_version text,
  add column if not exists privacy_consent_at timestamptz;

comment on column public.orders.privacy_policy_version is
  'Version of the CLICKOK privacy policy accepted by the buyer when placing this storefront order.';
comment on column public.orders.privacy_consent_at is
  'Server timestamp recording the buyer acceptance of the CLICKOK privacy notice for this order.';
