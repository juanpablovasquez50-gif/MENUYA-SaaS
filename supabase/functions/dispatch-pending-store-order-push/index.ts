// deno-lint-ignore-file no-import-prefix -- Supabase Edge Runtime supports the pinned esm.sh import.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-clickok-push-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
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
  if (!url || !serviceKey) return reply({ error: "Servicio push no configurado." }, 503);

  try {
    const db = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: pending, error } = await db
      .from("storefront_order_push_outbox")
      .select("id")
      .in("status", ["pending", "failed"])
      .lte("available_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(25);
    if (error) throw error;

    const results = await Promise.allSettled((pending || []).map(async (event) => {
      const response = await fetch(`${url}/functions/v1/send-store-order-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
          "x-clickok-push-secret": dispatchSecret,
        },
        body: JSON.stringify({ outbox_id: event.id }),
      });
      if (!response.ok) throw new Error(`Push dispatcher returned ${response.status}`);
    }));

    const sent = results.filter(result => result.status === "fulfilled").length;
    const failed = results.length - sent;
    return reply({ attempted: results.length, sent, failed });
  } catch (error) {
    console.error("dispatch-pending-store-order-push", error);
    return reply({ error: "No fue posible procesar la cola de notificaciones." }, 500);
  }
});
