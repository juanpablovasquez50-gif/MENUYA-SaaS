# Menuya storefront load test

The `menuya-storefront-100-vus.js` scenario simulates concurrent visitors opening a public storefront. It requests the rendered storefront route, resolves the public business, and loads categories, products, product options, option values, store settings and services using the same public Supabase REST resources as the frontend.

It is read-only: it does not sign in, create orders, update stock or write analytics. Run only against a preview frontend and an isolated Supabase test project with a published test storefront.

The GitHub Actions workflow `Menuya storefront 100 concurrent users` can be started manually. It ramps to 100 virtual users, holds that level for 60 seconds, then ramps down. Configure the repository secrets `MENUYA_TEST_SUPABASE_URL` and `MENUYA_TEST_SUPABASE_PUBLISHABLE_KEY`, then provide the isolated storefront slug.

Initial acceptance thresholds: HTTP errors below 1%, checks above 99%, and aggregate request p95 below 2 seconds. These are test targets, not measured results or a guarantee of capacity. The run artifact contains p50/p95/p99, request rate, errors and peak VUs.

## Read-only frontend and Supabase health baseline

The separate `menuya-v2-readonly.js` scenario checks the preview frontend, Supabase Auth health endpoint and Supabase REST root. It does not authenticate, create orders, modify inventory or write rows. It complements the storefront scenario; it does not replace it or represent authenticated Superadmin/business traffic.

Run it with k6 against an isolated Supabase test project:

```bash
BASE_URL=https://menuya-pruebas-v2.onrender.com \
SUPABASE_URL=https://YOUR-TEST-PROJECT.supabase.co \
SUPABASE_PUBLISHABLE_KEY=YOUR_TEST_PUBLISHABLE_KEY \
TARGET_VUS=10 \
k6 run tests/load/menuya-v2-readonly.js
```

Start at 10 VUs and increase gradually (25, 50, 100, etc.). Stop if errors, latency, resource pressure or alerts increase. The initial thresholds are HTTP errors below 1% and p95 below 1,500 ms; these are proposed test targets, not measured results or capacity guarantees. Never point this baseline at production.
```
