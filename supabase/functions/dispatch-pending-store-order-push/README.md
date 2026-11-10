# Pending storefront push outbox worker

The `dispatch-pending-store-order-push` Edge Function drains up to 25 due outbox events per call.

- Method: `POST`
- URL: `/functions/v1/dispatch-pending-store-order-push`
- Header: `x-clickok-push-secret: $CLICKOK_PUSH_DISPATCH_SECRET`
- Schedule recommendation: every minute.
- The worker uses the service role internally and delegates each event to `send-store-order-push`, which atomically claims it. Concurrent workers cannot claim the same active event.
- Failed deliveries remain in the outbox with exponential backoff. The worker only selects due events.
- Never commit the dispatch secret or service-role key.

The schedule is intentionally not installed by this pull request. Configure it in the target Supabase project only after the Edge Function secret is present and the migration/functions have been approved for deployment.
