import { createServer } from "node:http";
import { randomUUID, createHash } from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 30 });
const businessId = "11111111-1111-4111-8111-111111111111";
const productId = "22222222-2222-4222-8222-222222222222";
const server = createServer(async (req, res) => {
  res.setHeader("content-type", "application/json");
  if (req.method === "GET" && req.url === "/health") { res.writeHead(200).end("ok"); return; }\n  if (req.method !== "POST" || req.url !== "/orders") {
    res.writeHead(404).end(JSON.stringify({ error: "not_found" }));
    return;
  }
  try {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const input = JSON.parse(raw || "{}");
    const price = Number(input.price ?? 25000);
    const quantity = Number(input.quantity ?? 1);
    if (!Number.isFinite(price) || price < 0 || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      res.writeHead(400).end(JSON.stringify({ error: "invalid_payload" }));
      return;
    }
    const idempotencyKey = randomUUID();
    const trackingToken = randomUUID();
    const phone = `load-${randomUUID()}`;
    const total = price * quantity;
    const orderData = {
      fulfillment_type: "pickup",
      delivery_address: null,
      notes: "k6 disposable benchmark",
      payment_method: "Efectivo",
      privacy_policy_version: "1.0",
      privacy_consent_at: new Date().toISOString(),
      subtotal: total,
      delivery_fee: 0,
      total,
      tracking_token: trackingToken
    };
    const items = [{
      product_id: productId,
      product_name: "Producto k6",
      unit_price: price,
      quantity,
      line_total: total,
      variant_name: null,
      addons_snapshot: []
    }];
    const requestHash = createHash("sha256").update(JSON.stringify({ phone, price, quantity })).digest("hex");
    const result = await pool.query(
      "select public.create_storefront_order_atomic($1::uuid,$2::text,$3::text,$4::jsonb,$5::jsonb,$6::text,$7::uuid) as order_result",
      [businessId, "Cliente k6", phone, JSON.stringify(orderData), JSON.stringify(items), requestHash, idempotencyKey]
    );
    res.writeHead(200).end(JSON.stringify(result.rows[0].order_result));
  } catch (error) {
    console.error("benchmark request failed", error);
    res.writeHead(500).end(JSON.stringify({ error: "benchmark_request_failed" }));
  }
});
server.listen(Number(process.env.PORT || 8787), "127.0.0.1", () => {
  console.log("k6 RPC bridge listening on 127.0.0.1:8787");
});
process.on("SIGTERM", async () => {
  server.close();
  await pool.end();
});
