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
    const { business_id, order_number, customer_name, total } = await req.json();
    if (!business_id || !order_number) return reply({ error: "Pedido incompleto." }, 400);
    webpush.setVapidDetails(subject, publicKey, privateKey);
    const db = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: subscriptions, error } = await db
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth,preferences")
      .eq("business_id", business_id);
    if (error) throw error;

    const payload = JSON.stringify({
      title: "¡Nuevo pedido en tu vitrina!",
      body: `Pedido #${order_number} de ${customer_name || "un cliente"} · ${total || ""}`,
      url: "/app/pos",
      tag: `clickok-order-${order_number}`,
    });

    const results = await Promise.allSettled((subscriptions || [])
      .filter((item: any) => item.preferences?.new_order !== false)
      .map(async (item: any) => {
        try {
          await webpush.sendNotification({
            endpoint: item.endpoint,
            keys: { p256dh: item.p256dh, auth: item.auth },
          }, payload, { TTL: 60 * 60 });
          return "sent";
        } catch (pushError: any) {
          if (pushError?.statusCode === 404 || pushError?.statusCode === 410) {
            await db.from("push_subscriptions").delete().eq("id", item.id);
            return "expired";
          }
          throw pushError;
        }
      }));
    const sent = results.filter(result => result.status === "fulfilled").length;
    const failed = results.filter(result => result.status === "rejected").length;
    if (failed) console.error("push delivery failures", failed);
    return reply({ sent, failed });
  } catch (error) {
    console.error("send-store-order-push", error);
    return reply({ error: "No fue posible enviar las notificaciones." }, 500);
  }
});
