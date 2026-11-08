alter table public.cash_sessions
  add column if not exists cash_sales_amount numeric(14,2) not null default 0,
  add column if not exists transfer_sales_amount numeric(14,2) not null default 0,
  add column if not exists card_sales_amount numeric(14,2) not null default 0,
  add column if not exists other_sales_amount numeric(14,2) not null default 0,
  add column if not exists cash_difference numeric(14,2) not null default 0;

comment on column public.cash_sessions.expected_amount is 'Efectivo esperado: base inicial más ventas pagadas en efectivo.';
comment on column public.cash_sessions.closing_amount is 'Efectivo contado físicamente al cerrar la caja.';
comment on column public.cash_sessions.cash_difference is 'Diferencia entre efectivo contado y efectivo esperado.';
