import http from "k6";
import { check } from "k6";
import { Rate, Trend } from "k6/metrics";

const failures = new Rate("order_failures");
const rpcLatency = new Trend("order_rpc_http_ms", true);

export const options = {
  stages: [
    { duration: "10s", target: 1 },
    { duration: "30s", target: 1 },
    { duration: "10s", target: 5 },
    { duration: "30s", target: 5 },
    { duration: "10s", target: 10 },
    { duration: "30s", target: 10 },
    { duration: "10s", target: 0 }
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
    order_failures: ["rate<0.01"]
  }
};

export default function () {
  const payload = JSON.stringify({ price: 25000, quantity: 1 });
  const response = http.post("http://127.0.0.1:8787/orders", payload, {
    headers: { "Content-Type": "application/json" },
    tags: { endpoint: "atomic_order_rpc" }
  });
  rpcLatency.add(response.timings.duration);
  let body = {};
  try { body = response.json(); } catch (_) {}
  const ok = check(response, {
    "HTTP 200": (r) => r.status === 200,
    "RPC returned order id": () => typeof body.id === "string" && body.id.length > 0,
    "RPC returned order number": () => Number(body.order_number) > 0
  });
  failures.add(!ok);
}

export function handleSummary(data) {
  const metric = (name, key) => data.metrics[name]?.values?.[key] ?? null;
  const summary = {
    test: "Menuya atomic storefront order RPC via local HTTP bridge",
    scope: "Disposable PostgreSQL 16 in GitHub Actions; does not call production Supabase or the public storefront",
    duration_seconds: data.state.testRunDurationMs / 1000,
    total_requests: metric("http_reqs", "count"),
    requests_per_second: metric("http_reqs", "rate"),
    latency_ms: {
      p50: metric("order_rpc_http_ms", "med"),
      p95: metric("order_rpc_http_ms", "p(95)"),
      p99: metric("order_rpc_http_ms", "p(99)"),
      avg: metric("order_rpc_http_ms", "avg"),
      max: metric("order_rpc_http_ms", "max")
    },
    failed_request_rate: metric("http_req_failed", "rate"),
    checks_passed_rate: metric("checks", "rate"),
    vus_max: data.metrics.vus_max?.values?.max ?? null
  };
  return {
    stdout: JSON.stringify(summary, null, 2) + "\n",
    "k6-results/summary.json": JSON.stringify(summary, null, 2) + "\n"
  };
}
