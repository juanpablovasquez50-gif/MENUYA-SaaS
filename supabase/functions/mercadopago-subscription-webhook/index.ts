import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function parseSignature(value: string | null) {
  const parts = Object.fromEntries((value || "").split(",").map((part) => {
    const [key, ...rest] = part.trim().split("=");
    return [key, rest.join("=")];
  }));
  return { ts: parts.ts || "", v1: parts.v1 || "" };
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifySignature(signature: string | null, requestId: string | null, dataId: string, secret: string) {
  const { ts, v1 } = parseSignature(signature);
  if (!ts || !v1 || !requestId || !dataId) return false;
  const timestamp = Number(ts);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > 300) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const expected = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return safeEqual(expected.toLowerCase(), v1.toLowerCase());
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);
  try {
    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")?.trim();
    const webhookSecret = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET")?.trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
    if (!accessToken || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
      return json({ error: "Webhook no configurado." }, 503);
    }

    const payload = await req.json();
    const topic = String(payload?.type || payload?.topic || "");
    const dataId = String(payload?.data?.id || payload?.id || req.url && new URL(req.url).searchParams.get("data.id") || "");
    const eventId = String(payload?.id || `${topic}:${dataId}`);
    if (!topic || !dataId) return json({ error: "Notificación incompleta." }, 400);

    const valid = await verifySignature(
      req.headers.get("x-signature"),
      req.headers.get("x-request-id"),
      dataId,
      webhookSecret,
    );
    if (!valid) return json({ error: "Firma de webhook inválida." }, 401);

    const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    let resource: Record<string, unknown>;
    if (topic === "subscription_preapproval") {
      const response = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(dataId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      resource = await response.json();
      if (!response.ok) throw new Error("No se pudo consultar la suscripción en Mercado Pago.");
    } else if (topic === "subscription_authorized_payment") {
      const response = await fetch(`https://api.mercadopago.com/authorized_payments/${encodeURIComponent(dataId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      resource = await response.json();
      if (!response.ok) throw new Error("No se pudo consultar el cobro recurrente en Mercado Pago.");
    } else {
      return json({ received: true, ignored: "unsupported_topic" });
    }

    const externalReference = String(resource.external_reference || "");
    const preapprovalId = String(resource.preapproval_id || resource.id || "");
    const preapprovalStatus = topic === "subscription_preapproval" ? String(resource.status || "") : "";
    const paymentStatus = topic === "subscription_authorized_payment" ? String(resource.status || "") : "";
    const paymentId = topic === "subscription_authorized_payment" ? String(resource.id || dataId) : "";
    const transactionAmount = Number(resource.transaction_amount || resource.transaction_amount_refunded || 0);
    const amountInCents = transactionAmount > 0 ? Math.round(transactionAmount * 100) : null;
    const paymentDate = resource.date_approved || resource.debit_date || resource.date_created;

    const { data: result, error } = await db.rpc("apply_mercadopago_subscription_event", {
      p_event_id: eventId,
      p_event_type: topic,
      p_reference: externalReference,
      p_preapproval_id: preapprovalId || null,
      p_preapproval_status: preapprovalStatus || null,
      p_authorized_payment_id: paymentId || null,
      p_payment_status: paymentStatus || null,
      p_amount_in_cents: amountInCents,
      p_payment_date: paymentDate ? new Date(String(paymentDate)).toISOString() : null,
    });
    if (error) throw error;

    return json({ received: true, result: result?.result || "processed" });
  } catch (error) {
    console.error("mercadopago-subscription-webhook", error);
    return json({ error: "No fue posible procesar la notificación." }, 500);
  }
});
