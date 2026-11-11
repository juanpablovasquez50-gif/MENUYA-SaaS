import http from 'k6/http';
import { check, sleep } from 'k6';

// Safe, read-only baseline for Menuya V2.
// Required: BASE_URL, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY
// Run only against an isolated test project. Increase TARGET_VUS gradually.

const baseUrl = (__ENV.BASE_URL || 'https://menuya-pruebas-v2.onrender.com').replace(/\/$/, '');
const supabaseUrl = (__ENV.SUPABASE_URL || '').replace(/\/$/, '');
const publishableKey = __ENV.SUPABASE_PUBLISHABLE_KEY || '';
const targetVUs = Math.max(1, Number.parseInt(__ENV.TARGET_VUS || '10', 10));

if (!supabaseUrl || !publishableKey) {
  throw new Error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY for the isolated test project.');
}

export const options = {
  stages: [
    { duration: '30s', target: Math.max(1, Math.ceil(targetVUs * 0.2)) },
    { duration: '60s', target: targetVUs },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500'],
  },
};

const headers = {
  apikey: publishableKey,
  accept: 'application/json',
};

export default function () {
  const frontend = http.get(baseUrl, { tags: { target: 'frontend' } });
  check(frontend, {
    'frontend responds 200': (r) => r.status === 200,
  });

  const authHealth = http.get(`${supabaseUrl}/auth/v1/health`, {
    headers,
    tags: { target: 'supabase-auth-health' },
  });
  check(authHealth, {
    'Supabase Auth health responds 200': (r) => r.status === 200,
  });

  const restRoot = http.get(`${supabaseUrl}/rest/v1/`, {
    headers,
    tags: { target: 'supabase-rest-root' },
  });
  check(restRoot, {
    'Supabase REST root responds successfully': (r) => r.status >= 200 && r.status < 300,
  });

  sleep(1);
}
