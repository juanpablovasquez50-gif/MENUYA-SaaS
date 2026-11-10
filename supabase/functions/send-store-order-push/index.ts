import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-clickok-push-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});

Deno.serve(async (req: Request) => {
  let claimedOutboxId: string | null = null;
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Método no permitido." }, 405);

  const dispatchSecret = Deno.env.get("CLICKOK_PUSH_DISPATCH_SECRET");
  if (!dispatchSecret || req.headers.get("x-clickok-push-secret") !== dispatchSecret) {
    return reply({ error: "No autorizado." }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:soporte@clickok.co";
  if (!url || !serviceKey || !publicKey || !privateKey) {
    return reply({ error: "Servicio push no configurado." }, 503);
  }

  try {
    const { outbox_id } = await req.json();
    claimedOutboxId = String(outbox_id || "");
    if (!outbox_id || !/^[0-9a-f-]{36}$/i.test(String(outbox_id))) {
      return reply({ error: "Referencia de notificación no válida." }, 400);
    }
    const db = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: claimed, error: claimError } = await db
      .rpc("claim_storefront_order_push_outbox", { p_outbox_id: outbox_id });
    if (claimError) throw claimError;
    const outbox = Array.isArray(claimed) ? claimed[0] : claimed;
    if (!outbox) {
      const { data: existing, error: lookupError } = await db
        .from("storefront_order_push_outbox")
        .select("status,available_at")
        .eq("id", outbox_id)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (!existing) return reply({ error: "Notificación no encontrada." }, 404);
      if (existing.status === "sent") return reply({ sent: 0, failed: 0, already_sent: true });
      return reply({ error: "La notificación está en espera de reintento." }, 409);
    }

    const event = outbox.payload || {};
    const businessId = event.business_id;
    const orderNumber = event.order_number;
    if (!businessId || !orderNumber) throw new Error("El evento de notificación está incompleto.");
    webpush.setVapidDetails(subject, publicKey, privateKey);
    const { data: subscriptions, error } = await db
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth,preferences")
      .eq("business_id", businessId);
    if (error) throw error;

    const payload = JSON.stringify({
      title: "¡Nuevo pedido en tu vitrina!",
      body: `Pedido #${orderNumber} de ${event.customer_name || "un cliente"} · ${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(event.total || 0))}`,
      url: "/app/pos",
      tag: `clickok-order-${orderNumber}`,
    });

    type PushSubscriptionRow = {
      id: string;
      endpoint: string;
      p256dh: string;
      auth: string;
      preferences: { new_order?: boolean } | null;
    };
    const results = await Promise.allSettled(((subscriptions || []) as PushSubscriptionRow[])
      .filter((item) => item.preferences?.new_order !== false)
      .map(async (item) => {
        try {
          await webpush.sendNotification({
            endpoint: item.endpoint,
            keys: { p256dh: item.p256dh, auth: item.auth },
          }, payload, { TTL: 60 * 60 });
          return "sent";
        } catch (pushError: unknown) {
          const statusCode = typeof pushError === "object" && pushError !== null && "statusCode" in pushError
            ? Number((pushError as { statusCode?: unknown }).statusCode)
            : undefined;
          if (statusCode === 404 || statusCode === 410) {
            await db.from("push_subscriptions").delete().eq("id", item.id);
            return "expired";
          }
          throw pushError;
        }
      }));
    const sent = results.filter(result => result.status === "fulfilled").length;
    const failed = results.filter(result => result.status === "rejected").length;
    if (failed) {
      await db.from("storefront_order_push_outbox").update({
        status: "failed",
        available_at: new Date(Date.now() + Math.min(15 * 60_000, 30_000 * (2 ** Math.min(Number(outbox.attempts || 1) - 1, 5)))).toISOString(),
        locked_until: null,
        last_error: `${failed} subscription(s) failed`,
      }).eq("id", outbox_id);
      console.error("push delivery failures", failed);
      return reply({ sent, failed, retry_scheduled: true }, 503);
    }
    const { error: markError } = await db.from("storefront_order_push_outbox").update({
      status: "sent",
      delivered_at: new Date().toISOString(),
      locked_until: null,
      last_error: null,
    }).eq("id", outbox_id);
    if (markError) throw markError;
    return reply({ sent, failed: 0 });
  } catch (error) {
    console.error("send-store-order-push", error);
    if (claimedOutboxId) {
      try {
        await createClient(url!, serviceKey!, { auth: { persistSession: false } })
          .from("storefront_order_push_outbox")
          .update({
            status: "failed",
            available_at: new Date(Date.now() + 30_000).toISOString(),
            locked_until: null,
            last_error: error instanceof Error ? error.message.slice(0, 500) : "Push dispatch failed",
          })
          .eq("id", claimedOutboxId)
          .eq("status", "processing");
      } catch (updateError) {
        console.error("Could not release failed push outbox claim", updateError);
      }
    }
    return reply({ error: "No fue posible enviar las notificaciones." }, 500);
  }
});
