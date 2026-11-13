import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const supportEmail = Deno.env.get("CLICKOK_SUPPORT_EMAIL");
  const fromEmail = Deno.env.get("CLICKOK_FROM_EMAIL");
  if (!supabaseUrl || !anonKey || !serviceKey || !resendKey || !supportEmail || !fromEmail) {
    return json({ error: "Falta configurar el servicio de correo de CLICKOK Support." }, 503);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "No autorizado" }, 401);
  const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return json({ error: "Sesión no válida" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const [{ data: platformAdmin }, { data: supportAdmin }, { data: agent }] = await Promise.all([
    admin.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
    admin.from("clickok_support_admins").select("user_id,is_active").eq("user_id", user.id).eq("is_active", true).maybeSingle(),
    admin.from("clickok_support_agents").select("user_id,is_active").eq("user_id", user.id).eq("is_active", true).maybeSingle(),
  ]);
  if (!platformAdmin && !supportAdmin && !agent) return json({ error: "No tienes permisos para escalar tickets." }, 403);

  let payload: { conversationId?: string; message?: string; event?: string };
  try { payload = await req.json(); } catch { return json({ error: "Solicitud inválida" }, 400); }
  const conversationId = payload.conversationId;
  const event = payload.event;
  if (!conversationId || !["escalation", "agent_reply"].includes(event || "")) return json({ error: "Datos incompletos" }, 400);

  const { data: ticket, error: ticketError } = await admin
    .from("clickok_support_conversations")
    .select("id,subject,priority,status,businesses(name,email)")
    .eq("id", conversationId)
    .maybeSingle();
  if (ticketError || !ticket) return json({ error: "No se encontró el ticket" }, 404);
  if (ticket.priority !== "urgent") return json({ skipped: true, reason: "El ticket no es urgente" });

  const business = Array.isArray(ticket.businesses) ? ticket.businesses[0] : ticket.businesses;
  const businessName = business?.name || "Comercio CLICKOK";
  const ticketCode = ticket.id.slice(0, 8).toUpperCase();
  const message = (payload.message || "").trim();
  const subject = event === "escalation"
    ? `[CLICKOK URGENTE] Caso de pagos ${ticketCode}`
    : `[CLICKOK] Respuesta a tu caso urgente ${ticketCode}`;
  const recipients = event === "escalation"
    ? [supportEmail]
    : business?.email ? [business.email] : [];
  if (!recipients.length) return json({ error: "El comercio no tiene un correo registrado para recibir la respuesta." }, 422);

  const intro = event === "escalation"
    ? "Se escaló un ticket urgente que requiere revisión prioritaria, posiblemente relacionada con pagos o transacciones."
    : "El equipo de CLICKOK ha respondido tu solicitud urgente.";
  const detail = message ? `<h3>Respuesta del equipo</h3><p style="white-space:pre-wrap">${escapeHtml(message)}</p>` : "";
  const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#172033"><h2>CLICKOK Support</h2><p>${escapeHtml(intro)}</p><p><b>Ticket:</b> ${ticketCode}<br><b>Comercio:</b> ${escapeHtml(businessName)}<br><b>Asunto:</b> ${escapeHtml(ticket.subject)}<br><b>Estado:</b> ${escapeHtml(ticket.status)}</p>${detail}<p>Este caso también permanece registrado en CLICKOK Support.</p></div>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromEmail, to: recipients, subject, html }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return json({ error: "El proveedor de correo rechazó el envío.", details: result }, 502);
  await admin.from("clickok_support_events").insert({
    conversation_id: conversationId,
    actor_user_id: user.id,
    event_type: event === "escalation" ? "urgent_email_escalated" : "urgent_email_sent",
    details: { recipient: recipients[0], provider: "resend" },
  });
  return json({ sent: true, recipient: recipients[0] });
});
