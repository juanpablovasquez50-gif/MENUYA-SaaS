# Mercado Pago subscriptions for Menuya

This implementation is isolated from the existing Wompi subscription flow.

## Edge Functions

- `create-mercadopago-subscription-checkout` (JWT required): authenticates the Menuya user, checks business ownership/admin membership and active plan, creates a local pending payment, then creates a Mercado Pago `preapproval` and returns its `init_point`.
- `mercadopago-subscription-webhook` (public endpoint): validates Mercado Pago's `x-signature` HMAC-SHA256 header, retrieves the authoritative resource from Mercado Pago, and applies the event through a service-role-only database RPC.

## Required Supabase Edge Function secrets

- `MERCADOPAGO_ACCESS_TOKEN`: private access token for the Menuya/ATOM LABS Mercado Pago seller account.
- `MERCADOPAGO_WEBHOOK_SECRET`: secret generated in Mercado Pago Developers > Webhooks.
- Supabase-provided `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

Never expose these values in the browser, repository, logs, or client environment.

## Webhook topics

Enable:

- `subscription_preapproval`
- `subscription_authorized_payment`
- `payment` (recommended by Mercado Pago for payment updates; the handler only applies it when the resource includes Menuya's exact `external_reference`)

The webhook uses the notification only as a signal, verifies the signature, then fetches the authoritative resource from the Mercado Pago API before updating Menuya. Payment notifications without a matching Menuya reference are acknowledged and ignored; subscription state is not changed from an uncorrelated payment.

## Mercado Pago Developers configuration

Configure the webhook at the application level in **Tus integraciones > CLICKOK > Webhooks > Configurar notificaciones** (not in the Subscriptions documentation navigation). Set the test URL to:

`https://xbbdgsxlngosomwzkikq.supabase.co/functions/v1/mercadopago-subscription-webhook`

Enable the events **Planes y suscripciones** (`subscription_preapproval` and `subscription_authorized_payment`) and **Pagos** (`payment`). Save the configuration and copy the generated secret signature into the Supabase secret `MERCADOPAGO_WEBHOOK_SECRET`. Keep test and production URLs/credentials separate; do not use production credentials for this test.

## Database migration

Apply `supabase/migrations/20261111120000_mercadopago_subscription_provider.sql` to the Menuya production project only after reviewing it. It adds provider identifiers and an idempotency ledger without changing existing Wompi rows (their provider defaults to `wompi`).

## Important release gates

1. Confirm the seller account is approved and can receive payouts to its configured destination.
2. Configure test credentials and test webhook secret first.
3. Test first authorization, successful renewal, rejected renewal, cancellation, duplicate/out-of-order webhook delivery, and wrong amount.
4. Do not enable production credentials or change subscription status from browser redirects. Only verified webhooks may activate or renew a paid plan.
5. Verify the Mercado Pago API response fields for the account's Colombia subscription product before enabling production. The webhook handler expects the subscription resource to return `external_reference` and the authorized-payment resource to identify its related preapproval.
