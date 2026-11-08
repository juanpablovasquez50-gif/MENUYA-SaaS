import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Método no permitido." }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return reply({ error: "Servicio de seguimiento no configurado." }, 500);

    const { token } = await req.json();
    const cleanToken = String(token || "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanToken)) {
      return reply({ error: "Código de seguimiento no válido." }, 400);
    }

    const db = createClient(url, key, { auth: { persistSession: false } });
    const { data: order, error } = await db
      .from("orders")
      .select("business_id, order_number, status, created_at, updated_at")
      .eq("tracking_token", cleanToken)
      .maybeSingle();
    if (error) throw error;
    if (!order) return reply({ error: "No encontramos un pedido con ese código." }, 404);

    const { data: business, error: businessError } = await db
      .from("businesses")
      .select("name")
      .eq("id", order.business_id)
      .maybeSingle();
    if (businessError) throw businessError;

    return reply({
      order: {
        order_number: order.order_number,
        status: order.status,
        business_name: business?.name || "Comercio",
        created_at: order.created_at,
        updated_at: order.updated_at || order.created_at,
      },
    });
  } catch (error) {
    console.error("get-order-tracking", error);
    return reply({ error: "No fue posible consultar el pedido." }, 500);
  }
});
