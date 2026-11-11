import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function validReturnOrigin(origin: string | null): string | null {
  if (!origin) return null;
  try {
    const url = new URL(origin);
    const allowed = url.protocol === "https:" &&
      (url.hostname === "menuya.co" || url.hostname.endsWith(".menuya.co") || url.hostname.endsWith(".onrender.com"));
    return allowed ? url.origin : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")?.trim();
    if (!supabaseUrl || !serviceRoleKey || !accessToken) {
      return json({ error: "Mercado Pago no está configurado en el servidor." }, 503);
    }

    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token || token === authorization) return json({ error: "Debes iniciar sesión." }, 401);

    const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: authData, error: authError } = await db.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Sesión no válida." }, 401);

    const body = await req.json();
    const businessId = String(body?.business_id || "");
    const planId = String(body?.plan_id || "");
    if (!businessId || !planId) return json({ error: "Selecciona un comercio y un plan." }, 400);

    const payerEmail = String(authData.user.email || "").trim().toLowerCase();
    if (!payerEmail) return json({ error: "La cuenta necesita un correo electrónico verificado para crear la suscripción." }, 400);

    const userId = authData.user.id;
    const [{ data: business, error: businessError }, { data: membership, error: membershipError }, { data: plan, error: planError }] = await Promise.all([
      db.from("businesses").select("id,owner_id,status").eq("id", businessId).maybeSingle(),
      db.from("business_memberships").select("role,status").eq("business_id", businessId).eq("user_id", userId).eq("status", "active").in("role", ["owner", "admin"]).maybeSingle(),
      db.from("plans").select("id,code,name,price,billing_period,is_active").eq("id", planId).eq("is_active", true).maybeSingle(),
    ]);
    if (businessError || membershipError || planError) throw businessError || membershipError || planError;
    if (!business || business.status !== "active" || (business.owner_id !== userId && !membership)) {
      return json({ error: "No tienes permisos para administrar esta membresía." }, 403);
    }
    if (!plan || Number(plan.price) <= 0) return json({ error: "El plan seleccionado no requiere pago o no está disponible." }, 400);
    if (!["month", "year"].includes(plan.billing_period)) return json({ error: "Periodicidad del plan no válida." }, 400);

    const amount = Number(plan.price);
    if (!Number.isFinite(amount) || amount <= 0) return json({ error: "Precio de membresía no válido." }, 400);
    const amountInCents = Math.round(amount * 100);
    const reference = `MENUYA-MP-${businessId.slice(0, 8)}-${crypto.randomUUID().replaceAll("-", "")}`;

    const { error: insertError } = await db.from("subscription_payments").insert({
      business_id: businessId,
      plan_id: plan.id,
      reference,
      amount_in_cents: amountInCents,
      currency: "COP",
      status: "PENDING",
      payment_provider: "mercadopago",
      metadata: { checkout_created_at: new Date().toISOString() },
    });
    if (insertError) throw insertError;

    const origin = validReturnOrigin(req.headers.get("origin")) || validReturnOrigin(Deno.env.get("MENUYA_APP_URL") || null);
    const backUrl = origin ? new URL("/app/subscription?payment=return", origin).toString() : undefined;
    const frequency = plan.billing_period === "year" ? 12 : 1;
    const payload: Record<string, unknown> = {
      reason: `Membresía Menuya - ${plan.name}`,
      external_reference: reference,
      payer_email: payerEmail,
      auto_recurring: {
        frequency,
        frequency_type: "months",
        transaction_amount: amount,
        currency_id: "COP",
      },
      status: "pending",
    };
    if (backUrl) payload.back_url = backUrl;

    const mpResponse = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": reference,
      },
      body: JSON.stringify(payload),
    });
    const mpData = await mpResponse.json();
    if (!mpResponse.ok || !mpData?.id || !mpData?.init_point) {
      console.error("Mercado Pago preapproval creation failed", { status: mpResponse.status, response: mpData });
      await db.from("subscription_payments").update({ status: "ERROR", metadata: { checkout_error: "mercadopago_preapproval_failed" } }).eq("reference", reference);
      return json({ error: "Mercado Pago no pudo crear la suscripción. Verifica la cuenta y las credenciales." }, 502);
    }

    await db.from("subscription_payments")
      .update({ provider_subscription_id: String(mpData.id), metadata: { mercadopago_preapproval_id: String(mpData.id) } })
      .eq("reference", reference);

    return json({
      checkout_url: mpData.init_point,
      reference,
      preapproval_id: String(mpData.id),
      amount_in_cents: amountInCents,
      plan: plan.name,
      provider: "mercadopago",
    });
  } catch (error) {
    console.error("create-mercadopago-subscription-checkout", error);
    return json({ error: "No fue posible iniciar la suscripción. Intenta nuevamente." }, 500);
  }
});
