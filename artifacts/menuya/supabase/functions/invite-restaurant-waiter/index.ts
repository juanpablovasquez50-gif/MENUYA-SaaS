import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://menuya-pruebas-v2.onrender.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json({ error: "Faltan credenciales de servidor." }, 500);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Debes iniciar sesión." }, 401);
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Sesión inválida o vencida." }, 401);

  let body: { business_id?: string; email?: string; full_name?: string };
  try { body = await req.json(); } catch { return json({ error: "Solicitud inválida." }, 400); }
  const businessId = body.business_id?.trim();
  const email = body.email?.trim().toLowerCase();
  const fullName = body.full_name?.trim() || "";
  if (!businessId || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Indica un comercio y un correo válido." }, 400);
  }
  if (email.length > 254 || fullName.length > 100) return json({ error: "Datos demasiado largos." }, 400);

  const { data: membership, error: membershipError } = await adminClient
    .from("business_memberships").select("role,status")
    .eq("business_id", businessId).eq("user_id", authData.user.id)
    .eq("status", "active").maybeSingle();
  if (membershipError) return json({ error: "No fue posible validar tus permisos." }, 500);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return json({ error: "Solo el propietario o administrador puede invitar meseros." }, 403);
  }

  const { data: business, error: businessError } = await adminClient
    .from("businesses").select("id,business_type").eq("id", businessId).maybeSingle();
  if (businessError) return json({ error: "No fue posible consultar el comercio." }, 500);
  if (!business || business.business_type?.trim().toLowerCase() !== "restaurante") {
    return json({ error: "La gestión de meseros solo está disponible para restaurantes." }, 403);
  }

  const { data: subscriptionRows, error: subscriptionError } = await adminClient
    .from("subscriptions").select("plan_id,ends_at").eq("business_id", businessId)
    .eq("status", "active").order("created_at", { ascending: false }).limit(10);
  if (subscriptionError) return json({ error: "No fue posible consultar el plan." }, 500);
  const subscription = (subscriptionRows || []).find((item) => !item.ends_at || new Date(item.ends_at).getTime() > Date.now());
  if (!subscription) return json({ error: "El comercio no tiene un plan activo." }, 409);

  const { data: limitRow, error: limitError } = await adminClient
    .from("restaurant_plan_limits").select("max_waiters")
    .eq("plan_id", subscription.plan_id).maybeSingle();
  if (limitError) return json({ error: "No fue posible consultar el cupo." }, 500);
  if (!limitRow) return json({ error: "El cupo de meseros aún no está configurado para este plan." }, 409);

  const { count, error: countError } = await adminClient
    .from("business_memberships").select("id", { count: "exact", head: true })
    .eq("business_id", businessId).eq("role", "waiter").in("status", ["active", "invited"]);
  if (countError) return json({ error: "No fue posible verificar los meseros actuales." }, 500);
  if ((count ?? 0) >= limitRow.max_waiters) {
    return json({ error: "Se alcanzó el límite de meseros del plan.", current: count, limit: limitRow.max_waiters }, 409);
  }

  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, invited_business_id: businessId, invited_role: "waiter" },
  });
  if (inviteError || !invited.user) return json({ error: inviteError?.message || "No fue posible enviar la invitación." }, 400);

  const { error: insertError } = await adminClient.from("business_memberships").insert({
    business_id: businessId, user_id: invited.user.id, role: "waiter", status: "invited",
  });
  if (insertError) return json({
    error: "La invitación se envió, pero no se pudo registrar la membresía. Contacta soporte.",
    invitation_sent: true,
  }, 500);

  return json({ ok: true, invitation_sent: true, email, current: (count ?? 0) + 1, limit: limitRow.max_waiters });
});
