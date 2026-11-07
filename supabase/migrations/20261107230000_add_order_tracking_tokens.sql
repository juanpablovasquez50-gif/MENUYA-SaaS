-- Public order tracking uses an unguessable token; customers never receive database access.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_token text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_tracking_token_unique
  ON public.orders (tracking_token)
  WHERE tracking_token IS NOT NULL;
