import http from 'k6/http';
import { check, sleep } from 'k6';

// Read-only storefront load test. No logins, orders, inventory writes or analytics writes.
// Run ONLY against an isolated Supabase test project and a test storefront.
const baseUrl = (__ENV.BASE_URL || 'https://menuya-pruebas-v2.onrender.com').replace(/\/$/, '');
const slug = __ENV.STOREFRONT_SLUG || '';
const supabaseUrl = (__ENV.SUPABASE_URL || '').replace(/\/$/, '');
const publishableKey = __ENV.SUPABASE_PUBLISHABLE_KEY || '';
const targetVUs = Math.max(1, Number.parseInt(__ENV.TARGET_VUS || '100', 10));

if (!slug || !supabaseUrl || !publishableKey) {
  throw new Error('Set STOREFRONT_SLUG, SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY for an isolated test storefront.');
}

export const options = {
  stages: [
    { duration: '30s', target: Math.max(1, Math.ceil(targetVUs * 0.2)) },
    { duration: '60s', target: targetVUs },
    { duration: '60s', target: targetVUs },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
    checks: ['rate>0.99'],
  },
};

const apiHeaders = {
  apikey: publishableKey,
  Authorization: `Bearer ${publishableKey}`,
  Accept: 'application/json',
};
const api = (table, query) => ({
  method: 'GET',
  url: `${supabaseUrl}/rest/v1/${table}?${query}`,
  params: { headers: apiHeaders, tags: { endpoint: table } },
});

export default function () {
  const page = http.get(`${baseUrl}/${encodeURIComponent(slug)}`, {
    tags: { endpoint: 'storefront_html' },
  });
  check(page, { 'storefront HTML responds 200': (r) => r.status === 200 });

  const businessResponse = http.get(
    `${supabaseUrl}/rest/v1/businesses?select=id,name,slug,is_published&slug=eq.${encodeURIComponent(slug)}&limit=1`,
    { headers: apiHeaders, tags: { endpoint: 'storefront_business' } },
  );
  let business = null;
  try {
    const rows = businessResponse.json();
    business = Array.isArray(rows) ? rows[0] : null;
  } catch (_) {}
  check(businessResponse, {
    'public business lookup responds 200': (r) => r.status === 200,
    'storefront business is published': () => Boolean(business && business.id && business.is_published),
  });
  if (!business?.id) {
    sleep(1);
    return;
  }

  const id = encodeURIComponent(business.id);
  const responses = http.batch([
    api('categories', `select=id&business_id=eq.${id}&is_active=eq.true&order=sort_order.asc`),
    api('products', `select=id&business_id=eq.${id}&is_active=eq.true&is_available=eq.true&order=created_at.desc`),
    api('product_options', `select=id,product_id&business_id=eq.${id}&order=sort_order.asc`),
    api('product_option_values', `select=id,option_id&business_id=eq.${id}&is_active=eq.true&order=sort_order.asc`),
    api('store_settings', `select=business_id,is_published,brand_color&business_id=eq.${id}`),
    api('business_services', `select=id&business_id=eq.${id}&is_active=eq.true&order=name.asc`),
  ]);

  const names = ['categories', 'products', 'product_options', 'product_option_values', 'store_settings', 'business_services'];
  responses.forEach((response, index) => {
    check(response, {
      [`${names[index]} query responds 200`]: (r) => r.status === 200,
    });
  });
  sleep(1);
}

export function handleSummary(data) {
  const metric = (name, key) => data.metrics[name]?.values?.[key] ?? null;
  const summary = {
    test: 'Menuya public storefront read-only load',
    target_vus: targetVUs,
    duration_seconds: data.state.testRunDurationMs / 1000,
    total_requests: metric('http_reqs', 'count'),
    requests_per_second: metric('http_reqs', 'rate'),
    failed_request_rate: metric('http_req_failed', 'rate'),
    checks_passed_rate: metric('checks', 'rate'),
    latency_ms: {
      p50: metric('http_req_duration', 'med'),
      p95: metric('http_req_duration', 'p(95)'),
      p99: metric('http_req_duration', 'p(99)'),
      max: metric('http_req_duration', 'max'),
    },
    vus_max: data.metrics.vus_max?.values?.max ?? null,
    scope: 'Frontend HTML plus public Supabase storefront catalog reads; no order writes',
  };
  return {
    stdout: JSON.stringify(summary, null, 2) + '\n',
    'k6-results/storefront-100-vus-summary.json': JSON.stringify(summary, null, 2) + '\n',
  };
}
